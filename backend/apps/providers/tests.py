from datetime import datetime, time
import zoneinfo
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from apps.providers.models import Provider, Service, TimeOff, WorkingHour

User = get_user_model()


class ProviderModuleTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Create a provider user and profile
        self.provider_user = User.objects.create_user(
            email="dr.sarah@wellness.com",
            password="StrongPassword123!",
            role="provider",
            first_name="Sarah",
            last_name="Jenkins",
            timezone="America/New_York"
        )
        self.provider = Provider.objects.get(user=self.provider_user)

        # Create a customer user
        self.customer_user = User.objects.create_user(
            email="ahmed.customer@example.com",
            password="StrongPassword123!",
            role="customer",
            first_name="Ahmed",
            last_name="Khan",
            timezone="Asia/Karachi"
        )

    def test_get_own_provider_profile(self):
        self.client.force_authenticate(user=self.provider_user)
        response = self.client.get('/api/providers/me/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['display_name'], "Sarah Jenkins")
        self.assertEqual(response.data['timezone'], "America/New_York")
        self.assertEqual(response.data['min_notice_minutes'], 60)
        self.assertEqual(response.data['cancellation_hours'], 24)

    def test_update_provider_profile_valid_timezone(self):
        self.client.force_authenticate(user=self.provider_user)
        payload = {
            "display_name": "Dr. Sarah Wellness Clinic",
            "bio": "Certified Physical Therapist",
            "timezone": "Europe/London",
            "min_notice_minutes": 120,
            "cancellation_hours": 48
        }
        response = self.client.put('/api/providers/me/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['display_name'], "Dr. Sarah Wellness Clinic")
        self.assertEqual(response.data['timezone'], "Europe/London")
        self.assertEqual(response.data['min_notice_minutes'], 120)
        self.assertEqual(response.data['cancellation_hours'], 48)

    def test_update_provider_profile_rejects_invalid_timezone(self):
        self.client.force_authenticate(user=self.provider_user)
        payload = {
            "display_name": "Dr. Sarah Clinic",
            "timezone": "Invalid/Fake_Timezone"
        }
        response = self.client.patch('/api/providers/me/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('timezone', response.data)

    def test_customer_cannot_access_provider_me(self):
        self.client.force_authenticate(user=self.customer_user)
        response = self.client.get('/api/providers/me/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_service_crud_lifecycle(self):
        self.client.force_authenticate(user=self.provider_user)

        # 1. Create service
        create_payload = {
            "name": "Initial Assessment",
            "duration_minutes": 45,
            "buffer_minutes": 15,
            "price_amount": "90.00",
            "currency": "USD"
        }
        create_res = self.client.post('/api/providers/me/services/', create_payload, format='json')
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)
        service_id = create_res.data['id']
        self.assertEqual(create_res.data['name'], "Initial Assessment")

        # 2. List services
        list_res = self.client.get('/api/providers/me/services/')
        self.assertEqual(list_res.status_code, status.HTTP_200_OK)
        results = list_res.data.get('results', list_res.data)
        self.assertEqual(len(results), 1)

        # 3. Update service
        update_res = self.client.patch(
            f'/api/providers/me/services/{service_id}/',
            {"duration_minutes": 50},
            format='json'
        )
        self.assertEqual(update_res.status_code, status.HTTP_200_OK)
        self.assertEqual(update_res.data['duration_minutes'], 50)

        # 4. Delete service
        del_res = self.client.delete(f'/api/providers/me/services/{service_id}/')
        self.assertEqual(del_res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Service.objects.filter(id=service_id).count(), 0)

    def test_service_creation_rejects_zero_or_negative_duration(self):
        self.client.force_authenticate(user=self.provider_user)
        payload = {
            "name": "Bad Duration Service",
            "duration_minutes": 0,
            "buffer_minutes": 10,
            "price_amount": "50.00"
        }
        response = self.client.post('/api/providers/me/services/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('duration_minutes', response.data)

    def test_working_hours_bulk_update_success(self):
        self.client.force_authenticate(user=self.provider_user)
        payload = [
            {"weekday": 0, "start_time": "09:00:00", "end_time": "17:00:00"},
            {"weekday": 1, "start_time": "09:00:00", "end_time": "17:00:00"},
            {"weekday": 2, "start_time": "09:00:00", "end_time": "17:00:00"},
            {"weekday": 3, "start_time": "10:00:00", "end_time": "16:00:00"},
            {"weekday": 4, "start_time": "09:00:00", "end_time": "14:00:00"},
        ]
        response = self.client.put('/api/providers/me/working-hours/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 5)
        self.assertEqual(self.provider.working_hours.count(), 5)

    def test_working_hours_rejects_end_before_start(self):
        self.client.force_authenticate(user=self.provider_user)
        payload = [
            {"weekday": 0, "start_time": "17:00:00", "end_time": "09:00:00"}
        ]
        response = self.client.put('/api/providers/me/working-hours/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_time_off_lifecycle(self):
        self.client.force_authenticate(user=self.provider_user)
        payload = {
            "start_at": "2026-12-24T00:00:00Z",
            "end_at": "2026-12-26T23:59:59Z",
            "reason": "Winter Holidays"
        }
        create_res = self.client.post('/api/providers/me/time-off/', payload, format='json')
        self.assertEqual(create_res.status_code, status.HTTP_201_CREATED)
        time_off_id = create_res.data['id']

        # Delete time off
        del_res = self.client.delete(f'/api/providers/me/time-off/{time_off_id}/')
        self.assertEqual(del_res.status_code, status.HTTP_204_NO_CONTENT)

    def test_time_off_rejects_end_before_start(self):
        self.client.force_authenticate(user=self.provider_user)
        payload = {
            "start_at": "2026-12-26T00:00:00Z",
            "end_at": "2026-12-24T00:00:00Z",
            "reason": "Invalid Dates"
        }
        response = self.client.post('/api/providers/me/time-off/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_public_provider_directory(self):
        # Public search without authentication
        response = self.client.get('/api/providers/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', response.data)
        self.assertGreaterEqual(len(results), 1)

        # Public detail view
        detail_res = self.client.get(f'/api/providers/{self.provider.id}/')
        self.assertEqual(detail_res.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_res.data['display_name'], "Sarah Jenkins")
        self.assertIn('services', detail_res.data)
        self.assertIn('working_hours', detail_res.data)
