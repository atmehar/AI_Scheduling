from datetime import datetime, timedelta, timezone as dt_timezone
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from apps.accounts.models import CustomUser
from apps.providers.models import Provider, Service, WorkingHour
from apps.scheduling.models import Booking
from apps.ai_assistant.models import WaitlistEntry, BookingIntakeBrief, MeetingFollowUp
from apps.ai_assistant.services import AIWaitlistService


class AIAssistantTests(APITestCase):
    def setUp(self):
        self.provider_user = CustomUser.objects.create_user(
            email='provider.ai@example.com',
            password='Password123!',
            first_name='Alex',
            last_name='Morgan',
            role='provider'
        )
        self.provider = Provider.objects.get(user=self.provider_user)
        self.provider.display_name = 'Alex Morgan'
        self.provider.bio = 'Expert Legal & Financial Consultant'
        self.provider.timezone = 'UTC'
        self.provider.min_notice_minutes = 0
        self.provider.cancellation_hours = 1
        self.provider.save()
        self.service = Service.objects.create(
            provider=self.provider,
            name='Legal Consultation',
            duration_minutes=30,
            buffer_minutes=15,
            price_amount=100.00,
            currency='USD',
            is_active=True
        )
        # Working hours every day
        for d in range(7):
            WorkingHour.objects.create(
                provider=self.provider,
                weekday=d,
                start_time='09:00:00',
                end_time='18:00:00'
            )

        self.client_user = CustomUser.objects.create_user(
            email='client.ai@example.com',
            password='Password123!',
            first_name='Jordan',
            last_name='Lee',
            role='customer'
        )

        self.client_user2 = CustomUser.objects.create_user(
            email='client2.ai@example.com',
            password='Password123!',
            first_name='Taylor',
            last_name='Swift',
            role='customer'
        )

    def test_ai_concierge_query(self):
        self.client.force_authenticate(user=self.client_user)
        response = self.client.post('/api/ai/concierge/', {
            'query': 'I need a 30-min legal consultation with Alex next Tuesday afternoon',
            'timezone': 'UTC'
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn('parsed_parameters', data)
        self.assertIn('conversational_reply', data)
        self.assertIn('suggested_slots', data)
        self.assertEqual(data['parsed_parameters']['provider_name'], 'Alex Morgan')

    def test_ai_intake_brief_generation(self):
        start_time = timezone.now() + timedelta(days=2)
        end_time = start_time + timedelta(minutes=30)
        booking = Booking.objects.create(
            customer=self.client_user,
            provider=self.provider,
            service=self.service,
            start_at=start_time,
            end_at=end_time,
            status='confirmed',
            intake_notes='We are acquiring a SaaS company and need contractual due diligence review.'
        )

        # Provider retrieves AI brief
        self.client.force_authenticate(user=self.provider_user)
        response = self.client.get(f'/api/ai/intake-brief/{booking.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()
        self.assertIn('executive_summary', data)
        self.assertIn('agenda_items', data)
        self.assertIn('checklist', data)
        self.assertTrue(len(data['agenda_items']) > 0)
        self.assertTrue(len(data['checklist']) > 0)

    def test_ai_waitlist_and_cancellation_recovery(self):
        target_date = (timezone.now() + timedelta(days=3)).date()
        # Client 2 registers on waitlist
        self.client.force_authenticate(user=self.client_user2)
        wl_resp = self.client.post('/api/ai/waitlist/', {
            'provider_id': self.provider.id,
            'service_id': self.service.id,
            'preferred_date': str(target_date),
            'time_window': 'afternoon'
        })
        self.assertEqual(wl_resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(WaitlistEntry.objects.count(), 1)

        # Booking for that afternoon
        booking_start = datetime.combine(
            target_date,
            datetime.strptime('14:00', '%H:%M').time(),
            tzinfo=dt_timezone.utc
        )
        booking = Booking.objects.create(
            customer=self.client_user,
            provider=self.provider,
            service=self.service,
            start_at=booking_start,
            end_at=booking_start + timedelta(minutes=30),
            status='confirmed'
        )

        # Client 1 cancels booking
        self.client.force_authenticate(user=self.client_user)
        cancel_resp = self.client.post(f'/api/scheduling/bookings/{booking.id}/cancel/', {
            'reason': 'Schedule conflict'
        })
        self.assertEqual(cancel_resp.status_code, status.HTTP_200_OK)

        # Verify waitlist was notified
        entry = WaitlistEntry.objects.get(customer=self.client_user2)
        self.assertEqual(entry.status, 'notified')
        self.assertTrue(entry.is_notified)

    def test_meeting_followup_generate_and_send(self):
        start_time = timezone.now() - timedelta(hours=2)
        end_time = start_time + timedelta(minutes=30)
        booking = Booking.objects.create(
            customer=self.client_user,
            provider=self.provider,
            service=self.service,
            start_at=start_time,
            end_at=end_time,
            status='completed',
            intake_notes='Contract renegotiation'
        )

        self.client.force_authenticate(user=self.provider_user)
        # 1. Generate follow-up
        gen_resp = self.client.post('/api/ai/meeting-followup/generate/', {
            'booking_id': booking.id,
            'rough_notes': 'Agreed on 15% discount for 2-year term. Client to send revised clause by Friday.'
        })
        self.assertEqual(gen_resp.status_code, status.HTTP_200_OK)
        draft = gen_resp.json()
        self.assertIn('email_subject', draft)
        self.assertIn('email_body', draft)
        self.assertIn('action_items', draft)

        # 2. Provider sends follow-up
        send_resp = self.client.post(f'/api/ai/meeting-followup/{draft["id"]}/send/')
        self.assertEqual(send_resp.status_code, status.HTTP_200_OK)
        fu = MeetingFollowUp.objects.get(booking=booking)
        self.assertTrue(fu.is_sent)
