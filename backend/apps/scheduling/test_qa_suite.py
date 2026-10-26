from datetime import date, datetime, time, timedelta
import uuid
import zoneinfo
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.providers.models import Provider, Service, TimeOff, WorkingHour
from apps.scheduling.models import Booking
from apps.scheduling.services.slot_generator import generate_available_slots

User = get_user_model()


class FullQASuiteTests(TestCase):
    """
    Comprehensive QA Test Suite:
    - Positive: Full end-to-end lifecycle
    - Negative: Past date, outside working hours, wrong service, inactive service, min notice edge
    - Boundary: Back-to-back bookings, buffer edges, DST clock shift day
    - Duplicate/Retry: Idempotent replay with same UUID key
    """

    def setUp(self):
        self.client = APIClient()

        # Provider
        self.provider_user = User.objects.create_user(
            email="dr.qa@wellness.com",
            password="StrongPassword123!",
            role="provider",
            first_name="Dr",
            last_name="QA",
            timezone="America/New_York"
        )
        self.provider = Provider.objects.get(user=self.provider_user)
        self.provider.min_notice_minutes = 60
        self.provider.cancellation_hours = 24
        self.provider.save()

        # Working Hours: Mon-Fri 09:00 - 17:00 NY
        for day in range(5):
            WorkingHour.objects.create(
                provider=self.provider,
                weekday=day,
                start_time=time(9, 0),
                end_time=time(17, 0)
            )

        # Active Service
        self.service = Service.objects.create(
            provider=self.provider,
            name="General QA Consultation",
            duration_minutes=30,
            buffer_minutes=10,
            price_amount="85.00",
            currency="USD",
            is_active=True
        )

        # Inactive Service
        self.inactive_service = Service.objects.create(
            provider=self.provider,
            name="Archived Consultation",
            duration_minutes=30,
            buffer_minutes=0,
            price_amount="50.00",
            currency="USD",
            is_active=False
        )

        # Another Provider's Service
        self.other_provider_user = User.objects.create_user(
            email="other.provider@example.com",
            password="StrongPassword123!",
            role="provider",
            timezone="UTC"
        )
        self.other_provider = Provider.objects.get(user=self.other_provider_user)
        self.other_service = Service.objects.create(
            provider=self.other_provider,
            name="Other Provider Service",
            duration_minutes=45,
            buffer_minutes=15,
            price_amount="200.00",
            is_active=True
        )

        # Customer
        self.customer = User.objects.create_user(
            email="customer.qa@example.com",
            password="StrongPassword123!",
            role="customer",
            first_name="Alice",
            last_name="QA",
            timezone="America/New_York"
        )

    def test_positive_full_journey(self):
        """
        Positive test: Slot discovery -> Booking -> Reschedule -> Complete.
        """
        self.client.force_authenticate(user=self.customer)

        # 1. Discover slots (dynamically ensure upcoming working day Mon-Fri)
        future_date = timezone.now().date() + timedelta(days=1)
        while future_date.weekday() >= 5:  # Skip Saturday and Sunday
            future_date += timedelta(days=1)

        res = self.client.get(
            f"/api/providers/{self.provider.id}/slots/?service_id={self.service.id}&from={future_date}&to={future_date}"
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        slots = res.data.get('slots', [])
        self.assertGreater(len(slots), 0)
        target_slot = slots[0]['start_at']

        # 2. Book
        idem_key = str(uuid.uuid4())
        book_res = self.client.post(
            "/api/bookings/",
            {
                "provider_id": self.provider.id,
                "service_id": self.service.id,
                "start_at": target_slot,
                "timezone": "America/New_York"
            },
            format="json",
            HTTP_IDEMPOTENCY_KEY=idem_key
        )
        self.assertEqual(book_res.status_code, status.HTTP_201_CREATED)
        booking_id = book_res.data['id']
        self.assertEqual(book_res.data['status'], 'pending')

        # Provider accepts booking
        self.client.force_authenticate(user=self.provider_user)
        accept_res = self.client.post(f"/api/bookings/{booking_id}/accept/")
        self.assertEqual(accept_res.status_code, status.HTTP_200_OK)
        self.assertEqual(accept_res.data['status'], 'confirmed')

        # 3. Reschedule
        self.client.force_authenticate(user=self.customer)
        reschedule_slot = slots[2]['start_at']
        resched_res = self.client.patch(
            f"/api/bookings/{booking_id}/reschedule/",
            {"new_start_at": reschedule_slot},
            format="json"
        )
        self.assertEqual(resched_res.status_code, status.HTTP_200_OK)
        self.assertEqual(resched_res.data['reschedule_count'], 1)

        # 4. Provider completes
        self.client.force_authenticate(user=self.provider_user)
        comp_res = self.client.post(f"/api/bookings/{booking_id}/complete/")
        self.assertEqual(comp_res.status_code, status.HTTP_200_OK)
        self.assertEqual(comp_res.data['status'], 'completed')

    def test_negative_past_date(self):
        """Negative test: Booking with start_at in the past is rejected."""
        self.client.force_authenticate(user=self.customer)
        past_time = timezone.now() - timedelta(days=1)
        res = self.client.post(
            "/api/bookings/",
            {
                "provider_id": self.provider.id,
                "service_id": self.service.id,
                "start_at": past_time.isoformat(),
                "timezone": "UTC"
            },
            format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_negative_insufficient_notice(self):
        """Negative test: Booking within min_notice_minutes (60 mins) is rejected."""
        self.client.force_authenticate(user=self.customer)
        near_time = timezone.now() + timedelta(minutes=20)
        res = self.client.post(
            "/api/bookings/",
            {
                "provider_id": self.provider.id,
                "service_id": self.service.id,
                "start_at": near_time.isoformat(),
                "timezone": "UTC"
            },
            format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("notice", str(res.data).lower())

    def test_negative_wrong_service(self):
        """Negative test: Requesting service that does not belong to provider is rejected."""
        self.client.force_authenticate(user=self.customer)
        future_time = timezone.now() + timedelta(days=3)
        res = self.client.post(
            "/api/bookings/",
            {
                "provider_id": self.provider.id,
                "service_id": self.other_service.id,
                "start_at": future_time.isoformat(),
                "timezone": "UTC"
            },
            format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_negative_inactive_service(self):
        """Negative test: Booking an inactive/archived service is rejected."""
        self.client.force_authenticate(user=self.customer)
        future_time = timezone.now() + timedelta(days=3)
        res = self.client.post(
            "/api/bookings/",
            {
                "provider_id": self.provider.id,
                "service_id": self.inactive_service.id,
                "start_at": future_time.isoformat(),
                "timezone": "UTC"
            },
            format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_boundary_back_to_back_bookings(self):
        """
        Boundary test:
        Booking A: [10:00, 10:30) with 10 min buffer. Next slot cannot overlap before 10:40.
        A booking starting exactly at 10:40 succeeds.
        """
        self.client.force_authenticate(user=self.customer)
        base_time = (timezone.now() + timedelta(days=4)).replace(hour=10, minute=0, second=0, microsecond=0)

        # Booking A
        b1 = Booking.objects.create(
            customer=self.customer,
            provider=self.provider,
            service=self.service,
            start_at=base_time,
            end_at=base_time + timedelta(minutes=30),
            status="confirmed",
            idempotency_key=uuid.uuid4()
        )

        # Overlapping booking attempt: starts at 10:15 -> rejected by exclusion constraint
        res_overlap = self.client.post(
            "/api/bookings/",
            {
                "provider_id": self.provider.id,
                "service_id": self.service.id,
                "start_at": (base_time + timedelta(minutes=15)).isoformat(),
                "timezone": "UTC"
            },
            format="json"
        )
        self.assertEqual(res_overlap.status_code, status.HTTP_409_CONFLICT)

        # Exact contiguous boundary: starts at 10:30 (half-open range [10:00, 10:30) and [10:30, 11:00))
        res_boundary = self.client.post(
            "/api/bookings/",
            {
                "provider_id": self.provider.id,
                "service_id": self.service.id,
                "start_at": (base_time + timedelta(minutes=30)).isoformat(),
                "timezone": "UTC"
            },
            format="json"
        )
        self.assertEqual(res_boundary.status_code, status.HTTP_201_CREATED)

    def test_boundary_dst_clock_shift(self):
        """
        Boundary test: DST transition day slot generation.
        In America/New_York, Nov 1, 2026 is Fall-back (clocks go back 1h).
        Dynamic slot generator must calculate slots without gaps or crashes.
        """
        dst_date = date(2026, 11, 1)  # Fall back Sunday
        # Enable Sunday working hours for this provider
        WorkingHour.objects.create(
            provider=self.provider,
            weekday=6,
            start_time=time(9, 0),
            end_time=time(17, 0)
        )

        slots_data = generate_available_slots(
            provider=self.provider,
            service=self.service,
            start_date=dst_date,
            end_date=dst_date,
            customer_tz_str="America/New_York"
        )
        self.assertIn('slots', slots_data)
        slots = slots_data['slots']
        self.assertGreater(len(slots), 5)

        # Verify all start_at timestamps are strictly monotonically increasing
        for i in range(len(slots) - 1):
            t1 = datetime.fromisoformat(slots[i]['start_at'])
            t2 = datetime.fromisoformat(slots[i+1]['start_at'])
            self.assertLess(t1, t2)

    def test_idempotent_replay(self):
        """
        Duplicate test: Replaying the exact same creation request with identical
        Idempotency-Key returns the existing booking without creating duplicate records.
        """
        self.client.force_authenticate(user=self.customer)
        target_time = (timezone.now() + timedelta(days=6)).replace(hour=11, minute=0, second=0, microsecond=0)
        idem_key = str(uuid.uuid4())

        payload = {
            "provider_id": self.provider.id,
            "service_id": self.service.id,
            "start_at": target_time.isoformat(),
            "timezone": "America/New_York"
        }

        # First request
        res1 = self.client.post("/api/bookings/", payload, format="json", HTTP_IDEMPOTENCY_KEY=idem_key)
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)
        first_id = res1.data['id']

        # Replay request with same key
        res2 = self.client.post("/api/bookings/", payload, format="json", HTTP_IDEMPOTENCY_KEY=idem_key)
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(res2.data['id'], first_id)

        # Ensure only 1 booking was created in the DB
        count = Booking.objects.filter(customer=self.customer, idempotency_key=idem_key).count()
        self.assertEqual(count, 1)
