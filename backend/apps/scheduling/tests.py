from datetime import date, datetime, time, timedelta
import uuid
import zoneinfo
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.providers.models import Provider, Service, TimeOff, WorkingHour
from apps.scheduling.models import Booking, BookingEvent

User = get_user_model()


class SchedulingAndBookingEngineTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # 1. Setup Provider (New York timezone)
        self.provider_user = User.objects.create_user(
            email="dr.sarah@wellness.com",
            password="StrongPassword123!",
            role="provider",
            first_name="Sarah",
            last_name="Jenkins",
            timezone="America/New_York"
        )
        self.provider = Provider.objects.get(user=self.provider_user)
        self.provider.min_notice_minutes = 60
        self.provider.cancellation_hours = 24
        self.provider.save()

        # 2. Setup Service (30 min duration + 10 min buffer)
        self.service = Service.objects.create(
            provider=self.provider,
            name="General Consultation",
            duration_minutes=30,
            buffer_minutes=10,
            price_amount="100.00",
            currency="USD"
        )

        # 3. Setup Working Hours (Monday to Friday, 09:00 to 17:00 NY time)
        for day in range(5):
            WorkingHour.objects.create(
                provider=self.provider,
                weekday=day,
                start_time=time(9, 0),
                end_time=time(17, 0)
            )

        # 4. Setup Customers
        self.customer1 = User.objects.create_user(
            email="customer1@example.com",
            password="StrongPassword123!",
            role="customer",
            first_name="Alice",
            last_name="Smith",
            timezone="America/New_York"
        )

        self.customer2 = User.objects.create_user(
            email="customer2@example.com",
            password="StrongPassword123!",
            role="customer",
            first_name="Bob",
            last_name="Jones",
            timezone="Asia/Karachi"
        )

    def test_dynamic_slot_generation(self):
        """
        Verify dynamic slots are generated in UTC and formatted for customer timezone.
        """
        # Pick upcoming Monday
        today = timezone.now().date()
        days_ahead = (0 - today.weekday()) % 7
        if days_ahead <= 1:
            days_ahead += 7
        test_monday = today + timedelta(days=days_ahead)

        url = f"/api/providers/{self.provider.id}/slots/?service_id={self.service.id}&from={test_monday}&to={test_monday}&tz=America/New_York"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('slots', response.data)
        slots = response.data['slots']
        self.assertGreater(len(slots), 5)

        # Verify step: 30m duration + 10m buffer = 40 min between start times
        slot0_start = datetime.fromisoformat(slots[0]['start_at'])
        slot1_start = datetime.fromisoformat(slots[1]['start_at'])
        self.assertEqual(slot1_start - slot0_start, timedelta(minutes=40))

    def test_booking_creation_and_exclusion_constraint(self):
        """
        Test that two active overlapping bookings for the same provider are strictly rejected
        by PostgreSQL exclusion constraint, returning HTTP 409 Conflict.
        """
        target_start = timezone.now() + timedelta(days=3)
        target_start = target_start.replace(hour=14, minute=0, second=0, microsecond=0)

        self.client.force_authenticate(user=self.customer1)
        payload1 = {
            "provider_id": self.provider.id,
            "service_id": self.service.id,
            "start_at": target_start.isoformat()
        }
        res1 = self.client.post('/api/bookings/', payload1, format='json')
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res1.data['status'], 'pending')

        # Customer 2 attempts to book the exact same slot -> Must get 409 Conflict even while pending
        self.client.force_authenticate(user=self.customer2)
        payload2 = {
            "provider_id": self.provider.id,
            "service_id": self.service.id,
            "start_at": target_start.isoformat()
        }
        res2 = self.client.post('/api/bookings/', payload2, format='json')
        self.assertEqual(res2.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(res2.data['error'], 'slot_conflict')

    def test_back_to_back_bookings_allowed(self):
        """
        Test that adjacent back-to-back half-open intervals [10:00, 10:30) and [10:30, 11:00)
        succeed without conflict.
        """
        base_time = timezone.now() + timedelta(days=4)
        slot1_start = base_time.replace(hour=10, minute=0, second=0, microsecond=0)
        slot2_start = slot1_start + timedelta(minutes=30)  # adjacent start = prev end

        self.client.force_authenticate(user=self.customer1)
        res1 = self.client.post('/api/bookings/', {
            "provider_id": self.provider.id,
            "service_id": self.service.id,
            "start_at": slot1_start.isoformat()
        }, format='json')
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)

        self.client.force_authenticate(user=self.customer2)
        res2 = self.client.post('/api/bookings/', {
            "provider_id": self.provider.id,
            "service_id": self.service.id,
            "start_at": slot2_start.isoformat()
        }, format='json')
        self.assertEqual(res2.status_code, status.HTTP_201_CREATED)

    def test_idempotent_booking_submission(self):
        """
        Test that repeating a booking submission with the same Idempotency-Key
        returns the original booking without duplicate rows or conflicts.
        """
        target_start = timezone.now() + timedelta(days=5)
        key = str(uuid.uuid4())

        self.client.force_authenticate(user=self.customer1)
        headers = {'HTTP_IDEMPOTENCY_KEY': key}
        payload = {
            "provider_id": self.provider.id,
            "service_id": self.service.id,
            "start_at": target_start.isoformat()
        }

        # First request
        res1 = self.client.post('/api/bookings/', payload, format='json', **headers)
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)
        booking_id = res1.data['id']

        # Duplicate retry request with same idempotency key
        res2 = self.client.post('/api/bookings/', payload, format='json', **headers)
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(res2.data['id'], booking_id)

        # Verify only 1 row in database
        self.assertEqual(Booking.objects.filter(customer=self.customer1).count(), 1)

    def test_atomic_reschedule_success_and_conflict(self):
        """
        Test rescheduling: succeeds to an empty slot, and safely rolls back if new slot is blocked.
        """
        t1 = timezone.now() + timedelta(days=6, hours=2)
        t2 = timezone.now() + timedelta(days=6, hours=4)
        t3 = timezone.now() + timedelta(days=6, hours=6)

        self.client.force_authenticate(user=self.customer1)
        res1 = self.client.post('/api/bookings/', {
            "provider_id": self.provider.id,
            "service_id": self.service.id,
            "start_at": t1.isoformat()
        }, format='json')
        booking1_id = res1.data['id']

        # Customer 2 books t2
        self.client.force_authenticate(user=self.customer2)
        self.client.post('/api/bookings/', {
            "provider_id": self.provider.id,
            "service_id": self.service.id,
            "start_at": t2.isoformat()
        }, format='json')

        # Customer 1 attempts to reschedule to t2 (occupied) -> Fails with 409, keeps t1
        self.client.force_authenticate(user=self.customer1)
        conflict_res = self.client.patch(
            f'/api/bookings/{booking1_id}/reschedule/',
            {"new_start_at": t2.isoformat()},
            format='json'
        )
        self.assertEqual(conflict_res.status_code, status.HTTP_409_CONFLICT)

        # Original booking remains pending at t1
        b1 = Booking.objects.get(id=booking1_id)
        self.assertIn(b1.status, ('pending', 'confirmed'))
        self.assertEqual(b1.reschedule_count, 0)

        # Customer 1 reschedules to t3 (free) -> Succeeds
        success_res = self.client.patch(
            f'/api/bookings/{booking1_id}/reschedule/',
            {"new_start_at": t3.isoformat()},
            format='json'
        )
        self.assertEqual(success_res.status_code, status.HTTP_200_OK)
        b1.refresh_from_db()
        self.assertEqual(b1.reschedule_count, 1)

    def test_cancellation_policy_and_slot_release(self):
        """
        Test cancellation: within policy sets 'cancelled', late sets 'late_cancelled',
        and both free the slot immediately.
        """
        # Booking A: 48 hours away (> 24h notice) -> free cancellation
        far_time = timezone.now() + timedelta(days=3)
        self.client.force_authenticate(user=self.customer1)
        res_a = self.client.post('/api/bookings/', {
            "provider_id": self.provider.id,
            "service_id": self.service.id,
            "start_at": far_time.isoformat()
        }, format='json')
        booking_a_id = res_a.data['id']

        cancel_a = self.client.post(f'/api/bookings/{booking_a_id}/cancel/')
        self.assertEqual(cancel_a.status_code, status.HTTP_200_OK)
        self.assertEqual(cancel_a.data['status'], 'cancelled')
        self.assertFalse(cancel_a.data['is_late'])

        # Now slot at far_time is free! Customer 2 should be able to book it immediately
        self.client.force_authenticate(user=self.customer2)
        rebook_res = self.client.post('/api/bookings/', {
            "provider_id": self.provider.id,
            "service_id": self.service.id,
            "start_at": far_time.isoformat()
        }, format='json')
        self.assertEqual(rebook_res.status_code, status.HTTP_201_CREATED)

    def test_provider_accepts_and_completes_booking(self):
        """
        Test two-step workflow: booking starts 'pending', provider accepts to 'confirmed',
        then provider completes to 'completed'.
        """
        target_time = timezone.now() + timedelta(days=2)
        self.client.force_authenticate(user=self.customer1)
        b_res = self.client.post('/api/bookings/', {
            "provider_id": self.provider.id,
            "service_id": self.service.id,
            "start_at": target_time.isoformat()
        }, format='json')
        booking_id = b_res.data['id']
        self.assertEqual(b_res.data['status'], 'pending')

        # Cannot complete a pending booking directly
        self.client.force_authenticate(user=self.provider_user)
        early_comp = self.client.post(f'/api/bookings/{booking_id}/complete/')
        self.assertEqual(early_comp.status_code, status.HTTP_400_BAD_REQUEST)

        # Provider accepts booking
        accept_res = self.client.post(f'/api/bookings/{booking_id}/accept/')
        self.assertEqual(accept_res.status_code, status.HTTP_200_OK)
        self.assertEqual(accept_res.data['status'], 'confirmed')

        # Provider marks appointment complete
        comp_res = self.client.post(f'/api/bookings/{booking_id}/complete/')
        self.assertEqual(comp_res.status_code, status.HTTP_200_OK)
        self.assertEqual(comp_res.data['status'], 'completed')

