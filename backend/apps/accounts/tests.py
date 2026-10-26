from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

User = get_user_model()


class AuthenticationAndRoleTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Pre-seed a test customer and test provider
        self.customer = User.objects.create_user(
            email="ahmed.customer@example.com",
            password="StrongPassword123!",
            role="customer",
            first_name="Ahmed",
            last_name="Khan",
            timezone="Asia/Karachi"
        )

        self.provider = User.objects.create_user(
            email="dr.sarah@example.com",
            password="StrongPassword123!",
            role="provider",
            first_name="Sarah",
            last_name="Jenkins",
            timezone="America/New_York"
        )

    def test_customer_registration_success(self):
        payload = {
            "email": "new.customer@example.com",
            "password": "ValidPassword456!",
            "role": "customer",
            "first_name": "Zaid",
            "last_name": "Ali",
            "timezone": "Asia/Karachi"
        }
        response = self.client.post('/api/auth/register/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['email'], "new.customer@example.com")
        self.assertEqual(response.data['role'], "customer")
        self.assertIn('tokens', response.data)
        self.assertIn('access', response.data['tokens'])
        self.assertIn('refresh', response.data['tokens'])

    def test_provider_registration_success(self):
        payload = {
            "email": "new.provider@example.com",
            "password": "ValidPassword456!",
            "role": "provider",
            "first_name": "Tariq",
            "last_name": "Mahmood",
            "timezone": "Asia/Karachi"
        }
        response = self.client.post('/api/auth/register/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['role'], "provider")
        self.assertIn('tokens', response.data)

    def test_registration_rejects_invalid_role(self):
        payload = {
            "email": "bad.role@example.com",
            "password": "ValidPassword456!",
            "role": "admin"  # Admin registration not allowed publicly
        }
        response = self.client.post('/api/auth/register/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_registration_rejects_duplicate_email(self):
        payload = {
            "email": "ahmed.customer@example.com",  # Already exists
            "password": "ValidPassword456!",
            "role": "customer"
        }
        response = self.client.post('/api/auth/register/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_success_with_tokens_and_user_profile(self):
        payload = {
            "email": "dr.sarah@example.com",
            "password": "StrongPassword123!"
        }
        response = self.client.post('/api/auth/token/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertIn('user', response.data)
        self.assertEqual(response.data['user']['email'], "dr.sarah@example.com")
        self.assertEqual(response.data['user']['role'], "provider")

    def test_login_fails_with_invalid_credentials(self):
        payload = {
            "email": "dr.sarah@example.com",
            "password": "WrongPassword!"
        }
        response = self.client.post('/api/auth/token/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_token_refresh(self):
        # Obtain tokens first
        login_res = self.client.post('/api/auth/token/', {
            "email": "ahmed.customer@example.com",
            "password": "StrongPassword123!"
        }, format='json')
        refresh_token = login_res.data['refresh']

        # Refresh
        refresh_res = self.client.post('/api/auth/token/refresh/', {
            "refresh": refresh_token
        }, format='json')
        self.assertEqual(refresh_res.status_code, status.HTTP_200_OK)
        self.assertIn('access', refresh_res.data)

    def test_me_endpoint_authenticated(self):
        self.client.force_authenticate(user=self.customer)
        response = self.client.get('/api/auth/me/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['email'], "ahmed.customer@example.com")
        self.assertEqual(response.data['role'], "customer")

    def test_me_endpoint_unauthenticated(self):
        response = self.client.get('/api/auth/me/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
