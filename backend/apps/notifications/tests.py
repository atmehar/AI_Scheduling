from datetime import time, timedelta
from io import StringIO
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.notifications.management.commands.run_reminders import process_due_reminders
from apps.notifications.models import Reminder
from apps.providers.models import Provider, Service, WorkingHour
from apps.scheduling.models import Booking
from apps.scheduling.services.booking_service import BookingService

User = get_user_model()


class NotificationAndWorkerTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # 1. Setup Provider
        self.provider_user = User.objects.create_user(
            email="dr.sarah@wellness.com",
            password="StrongPassword123!",
            role="provider",
            first_name="Sarah",
            last_name="Jenkins",
            timezone="America/New_York"
        )
        self.provider = Provider.objects.get(user=self.provider_user)

        # 2. Setup Service
        self.service = Service.objects.create(
            provider=self.provider,
            name="General Consultation",
            duration_minutes=30,
            buffer_minutes=10,
            price_amount="80.00"
        )

        # 3. Setup Customer
        self.customer = User.objects.create_user(
            email="ahmed.client@example.com",
            password="StrongPassword123!",
            role="customer",
            first_name="Ahmed",
            last_name="Khan",
            timezone="Asia/Karachi"
        )

    def test_reminders_automatically_scheduled_on_booking(self):
        """
        Verify that creating a booking and accepting it automatically schedules
        a 24-hour and a 1-hour advance reminder.
        """
        start_at = timezone.now() + timedelta(days=3)
        booking, _ = BookingService.create_booking(
            customer=self.customer,
            provider=self.provider,
            service=self.service,
            start_at=start_at,
            idempotency_key=Booking._meta.get_field('idempotency_key').default()
        )
        BookingService.accept_booking(booking.id, self.provider_user)

        reminders = Reminder.objects.filter(booking=booking)
        self.assertEqual(reminders.count(), 2)

        # Confirm target times
        t_24h = start_at - timedelta(hours=24)
        t_1h = start_at - timedelta(hours=1)
        scheduled_times = [r.scheduled_for for r in reminders]
        self.assertIn(t_24h, scheduled_times)
        self.assertIn(t_1h, scheduled_times)

    def test_reschedule_updates_reminders(self):
        """
        Verify that rescheduling an appointment cancels previous pending reminders
        and creates new ones for the updated time.
        """
        start_at = timezone.now() + timedelta(days=3)
        booking, _ = BookingService.create_booking(
            customer=self.customer,
            provider=self.provider,
            service=self.service,
            start_at=start_at,
            idempotency_key=Booking._meta.get_field('idempotency_key').default()
        )
        BookingService.accept_booking(booking.id, self.provider_user)

        # Initial reminders are pending
        self.assertEqual(Reminder.objects.filter(booking=booking, status='pending').count(), 2)

        # Reschedule to day 5
        new_start = timezone.now() + timedelta(days=5)
        BookingService.reschedule_booking(
            booking_id=booking.id,
            new_start_at=new_start,
            user=self.customer
        )

        # Old reminders cancelled, new reminders pending
        self.assertEqual(Reminder.objects.filter(booking=booking, status='cancelled').count(), 2)
        self.assertEqual(Reminder.objects.filter(booking=booking, status='pending').count(), 2)

    def test_cancellation_cancels_reminders(self):
        """
        Verify that cancelling an appointment cancels all pending reminders.
        """
        start_at = timezone.now() + timedelta(days=3)
        booking, _ = BookingService.create_booking(
            customer=self.customer,
            provider=self.provider,
            service=self.service,
            start_at=start_at,
            idempotency_key=Booking._meta.get_field('idempotency_key').default()
        )
        BookingService.accept_booking(booking.id, self.provider_user)

        BookingService.cancel_booking(booking_id=booking.id, user=self.customer)
        self.assertEqual(Reminder.objects.filter(booking=booking, status='pending').count(), 0)
        self.assertEqual(Reminder.objects.filter(booking=booking, status='cancelled').count(), 2)

    def test_worker_processes_due_reminders_successfully(self):
        """
        Verify the background worker claims due reminders and marks them as sent.
        """
        start_at = timezone.now() + timedelta(hours=2)
        booking, _ = BookingService.create_booking(
            customer=self.customer,
            provider=self.provider,
            service=self.service,
            start_at=start_at,
            idempotency_key=Booking._meta.get_field('idempotency_key').default()
        )
        BookingService.accept_booking(booking.id, self.provider_user)

        # Artificially set a reminder to be due (scheduled_for <= now)
        reminder = Reminder.objects.filter(booking=booking).first()
        reminder.scheduled_for = timezone.now() - timedelta(minutes=5)
        reminder.save()

        sent_count = process_due_reminders(batch_size=10)
        self.assertGreaterEqual(sent_count, 1)

        reminder.refresh_from_db()
        self.assertEqual(reminder.status, 'sent')
        self.assertIsNotNone(reminder.sent_at)
        self.assertEqual(reminder.attempts, 1)

    def test_worker_exponential_retry_on_failure(self):
        """
        Verify that a failed dispatch increments attempts and applies exponential backoff.
        """
        start_at = timezone.now() + timedelta(hours=2)
        booking, _ = BookingService.create_booking(
            customer=self.customer,
            provider=self.provider,
            service=self.service,
            start_at=start_at,
            idempotency_key=Booking._meta.get_field('idempotency_key').default()
        )
        BookingService.accept_booking(booking.id, self.provider_user)

        reminder = Reminder.objects.filter(booking=booking).first()
        reminder.scheduled_for = timezone.now() - timedelta(minutes=5)
        reminder.save()

        # Run worker with simulated failure
        process_due_reminders(batch_size=10, simulate_failure=True)

        reminder.refresh_from_db()
        self.assertEqual(reminder.status, 'pending')
        self.assertEqual(reminder.attempts, 1)
        self.assertIn("Simulated network drop", reminder.last_error)
        self.assertGreater(reminder.scheduled_for, timezone.now())

    def test_worker_fails_after_max_attempts(self):
        """
        Verify that a reminder transitions to 'failed' when attempts reach max_attempts.
        """
        start_at = timezone.now() + timedelta(hours=2)
        booking, _ = BookingService.create_booking(
            customer=self.customer,
            provider=self.provider,
            service=self.service,
            start_at=start_at,
            idempotency_key=Booking._meta.get_field('idempotency_key').default()
        )
        BookingService.accept_booking(booking.id, self.provider_user)

        reminder = Reminder.objects.filter(booking=booking).first()
        reminder.scheduled_for = timezone.now() - timedelta(minutes=5)
        reminder.attempts = 2  # Max is 3
        reminder.save()

        # Run with failure -> 3rd attempt
        process_due_reminders(batch_size=10, simulate_failure=True)

        reminder.refresh_from_db()
        self.assertEqual(reminder.attempts, 3)
        self.assertEqual(reminder.status, 'failed')

    def test_user_notifications_feed_api(self):
        """
        Verify GET /api/notifications/ returns structured notifications feed for provider and customer.
        """
        start_at = timezone.now() + timedelta(days=2)
        booking, _ = BookingService.create_booking(
            customer=self.customer,
            provider=self.provider,
            service=self.service,
            start_at=start_at,
            idempotency_key=Booking._meta.get_field('idempotency_key').default()
        )

        # Provider feed before acceptance (shows unread pending request)
        self.client.force_authenticate(user=self.provider_user)
        res_provider = self.client.get('/api/notifications/')
        self.assertEqual(res_provider.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(res_provider.data['unread_count'], 1)
        self.assertTrue(any(n['type'] == 'booking_request' for n in res_provider.data['results']))

        # Customer feed
        self.client.force_authenticate(user=self.customer)
        res_customer = self.client.get('/api/notifications/')
        self.assertEqual(res_customer.status_code, status.HTTP_200_OK)
        self.assertTrue(any(n['type'] == 'booking_submitted' for n in res_customer.data['results']))

    def test_run_reminders_command_cli(self):
        """
        Verify running the custom management command via call_command with --once.
        """
        out = StringIO()
        call_command('run_reminders', '--once', stdout=out)
        output = out.getvalue()
        self.assertIn("Starting Reminders Background Queue Worker", output)
        self.assertIn("Finished processing batch", output)

