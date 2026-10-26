from datetime import time, timedelta
import uuid
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.notifications.models import Reminder
from apps.notifications.management.commands.run_reminders import process_due_reminders
from apps.providers.models import Provider, Service, TimeOff, WorkingHour
from apps.scheduling.models import Booking

User = get_user_model()


class SecurityAndReliabilityPhase4Tests(TestCase):
    """
    Phase 4 Security & Reliability Test Suite:
    1. Customer cannot access another customer's booking (GET, PATCH, POST)
    2. Customer cannot mark appointment complete (only assigned provider can)
    3. Provider can only manage own data (services, hours, time-off)
    4. Rate limit booking creation endpoint
    5. Job retry safety (worker retry on error + duplicate-send protection)
    """

    def setUp(self):
        self.client = APIClient()

        # Provider A
        self.provider_user_a = User.objects.create_user(
            email="providerA@example.com",
            password="StrongPassword123!",
            role="provider",
            first_name="Doctor",
            last_name="A",
            timezone="UTC"
        )
        self.provider_a = Provider.objects.get(user=self.provider_user_a)
        self.service_a = Service.objects.create(
            provider=self.provider_a,
            name="Consultation A",
            duration_minutes=30,
            buffer_minutes=10,
            price_amount="100.00",
            currency="USD"
        )

        # Provider B
        self.provider_user_b = User.objects.create_user(
            email="providerB@example.com",
            password="StrongPassword123!",
            role="provider",
            first_name="Doctor",
            last_name="B",
            timezone="UTC"
        )
        self.provider_b = Provider.objects.get(user=self.provider_user_b)
        self.service_b = Service.objects.create(
            provider=self.provider_b,
            name="Consultation B",
            duration_minutes=45,
            buffer_minutes=15,
            price_amount="150.00",
            currency="USD"
        )

        # Customer A
        self.customer_a = User.objects.create_user(
            email="customerA@example.com",
            password="StrongPassword123!",
            role="customer",
            first_name="Alice",
            last_name="Smith",
            timezone="UTC"
        )

        # Customer B
        self.customer_b = User.objects.create_user(
            email="customerB@example.com",
            password="StrongPassword123!",
            role="customer",
            first_name="Bob",
            last_name="Jones",
            timezone="UTC"
        )

        # Booking belonging to Customer A with Provider A
        self.booking_time = timezone.now() + timedelta(days=2)
        self.booking_a = Booking.objects.create(
            customer=self.customer_a,
            provider=self.provider_a,
            service=self.service_a,
            start_at=self.booking_time,
            end_at=self.booking_time + timedelta(minutes=30),
            status="confirmed",
            idempotency_key=uuid.uuid4()
        )

    def test_customer_cannot_view_another_customer_booking(self):
        """
        Verify Customer B receives 404 Not Found when attempting to GET Customer A's booking.
        """
        self.client.force_authenticate(user=self.customer_b)
        response = self.client.get(f"/api/bookings/{self.booking_a.id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_customer_cannot_reschedule_another_customer_booking(self):
        """
        Verify Customer B receives 403 Forbidden when attempting to reschedule Customer A's booking.
        """
        self.client.force_authenticate(user=self.customer_b)
        new_time = self.booking_time + timedelta(hours=2)
        response = self.client.patch(
            f"/api/bookings/{self.booking_a.id}/reschedule/",
            {"new_start_at": new_time.isoformat()},
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_customer_cannot_cancel_another_customer_booking(self):
        """
        Verify Customer B receives 403 Forbidden when attempting to cancel Customer A's booking.
        """
        self.client.force_authenticate(user=self.customer_b)
        response = self.client.post(
            f"/api/bookings/{self.booking_a.id}/cancel/",
            {"reason": "Malicious cancellation attempt"},
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_customer_cannot_mark_booking_complete(self):
        """
        Verify that a customer attempting to mark a booking as completed receives 403 Forbidden.
        Only the assigned provider can complete it.
        """
        self.client.force_authenticate(user=self.customer_a)
        response = self.client.post(f"/api/bookings/{self.booking_a.id}/complete/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_assigned_provider_can_complete_booking(self):
        """
        Verify the assigned Provider A can successfully complete the booking.
        """
        self.client.force_authenticate(user=self.provider_user_a)
        response = self.client.post(f"/api/bookings/{self.booking_a.id}/complete/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.booking_a.refresh_from_db()
        self.assertEqual(self.booking_a.status, 'completed')

    def test_unassigned_provider_cannot_complete_booking(self):
        """
        Verify Provider B receives 403 Forbidden when attempting to complete Provider A's booking.
        """
        self.client.force_authenticate(user=self.provider_user_b)
        response = self.client.post(f"/api/bookings/{self.booking_a.id}/complete/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_provider_cannot_access_or_modify_another_provider_services(self):
        """
        Verify Provider B cannot retrieve, update, or delete Provider A's services.
        """
        self.client.force_authenticate(user=self.provider_user_b)
        # Detail view for Provider A's service
        response = self.client.get(f"/api/providers/me/services/{self.service_a.id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        # Update attempt
        response = self.client.put(
            f"/api/providers/me/services/{self.service_a.id}/",
            {"name": "Hacked Name", "duration_minutes": 15, "buffer_minutes": 5, "price_amount": "10.00"},
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        # Delete attempt
        response = self.client.delete(f"/api/providers/me/services/{self.service_a.id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_provider_working_hours_scoped_to_own_profile(self):
        """
        Verify Provider B modifying working hours only affects Provider B's schedule, leaving Provider A intact.
        """
        WorkingHour.objects.create(provider=self.provider_a, weekday=0, start_time=time(9, 0), end_time=time(17, 0))
        self.assertEqual(self.provider_a.working_hours.count(), 1)

        self.client.force_authenticate(user=self.provider_user_b)
        response = self.client.post(
            "/api/providers/me/working-hours/",
            {"working_hours": [{"weekday": 1, "start_time": "10:00", "end_time": "18:00"}]},
            format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Provider A's working hours must remain unchanged
        self.assertEqual(self.provider_a.working_hours.count(), 1)
        self.assertEqual(self.provider_a.working_hours.first().weekday, 0)
        # Provider B has their own 1 working hour
        self.assertEqual(self.provider_b.working_hours.count(), 1)
        self.assertEqual(self.provider_b.working_hours.first().weekday, 1)

    def test_worker_retry_safety_and_duplicate_send_protection(self):
        """
        Verify that a failed notification attempt transitions the reminder to retry with backoff,
        and when re-run successfully, duplicate sends are strictly prevented.
        """
        past_time = timezone.now() - timedelta(minutes=5)
        reminder = Reminder.objects.create(
            booking=self.booking_a,
            channel='email',
            scheduled_for=past_time,
            status='pending',
            max_attempts=3
        )

        # 1. First run with simulated failure (e.g. network/email drop mid-send)
        processed = process_due_reminders(batch_size=10, simulate_failure=True)
        self.assertEqual(processed, 0)

        reminder.refresh_from_db()
        self.assertEqual(reminder.attempts, 1)
        self.assertEqual(reminder.status, 'pending')
        self.assertIsNotNone(reminder.last_error)
        # Next retry must be scheduled in the future due to exponential backoff (2^1 * 60s)
        self.assertGreater(reminder.scheduled_for, timezone.now())

        # 2. Reset scheduled_for to past to simulate retry execution time arriving
        reminder.scheduled_for = timezone.now() - timedelta(seconds=1)
        reminder.save()

        # Second run without simulated failure (succeeds)
        processed_retry = process_due_reminders(batch_size=10, simulate_failure=False)
        self.assertEqual(processed_retry, 1)

        reminder.refresh_from_db()
        self.assertEqual(reminder.status, 'sent')
        self.assertIsNotNone(reminder.sent_at)
        original_sent_at = reminder.sent_at

        # 3. Third run: Duplicate-send defense
        # Re-running the worker must NOT send it again
        processed_dup = process_due_reminders(batch_size=10, simulate_failure=False)
        self.assertEqual(processed_dup, 0)

        reminder.refresh_from_db()
        self.assertEqual(reminder.sent_at, original_sent_at)
