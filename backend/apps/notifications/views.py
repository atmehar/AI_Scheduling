from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.notifications.models import Reminder
from apps.notifications.serializers import ReminderSerializer
from apps.scheduling.models import Booking, BookingEvent


class UserNotificationFeedView(APIView):
    """
    Unified in-app notification feed returning real-time appointment events,
    pending booking action requests, and reminder delivery statuses for the authenticated user.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        notifications = []

        # Find user's active/relevant bookings
        if user.role == 'admin':
            bookings = Booking.objects.all().select_related('customer', 'provider', 'service')
        elif user.role == 'provider':
            bookings = Booking.objects.filter(provider__user=user).select_related('customer', 'provider', 'service')
        else:
            bookings = Booking.objects.filter(customer=user).select_related('customer', 'provider', 'service')

        booking_map = {b.id: b for b in bookings}
        booking_ids = list(booking_map.keys())

        if booking_ids:
            # 1. Booking Events (Lifecycle alerts)
            events = BookingEvent.objects.filter(booking_id__in=booking_ids).order_by('-created_at')[:25]
            for evt in events:
                b = booking_map.get(evt.booking_id)
                if not b:
                    continue

                if evt.event_type == 'created':
                    if user.role == 'provider':
                        notifications.append({
                            'id': f"event-{evt.id}",
                            'type': 'booking_request',
                            'title': 'New Booking Request',
                            'message': f"{b.customer.email} requested {b.service.name} for {b.start_at.strftime('%b %d, %Y at %I:%M %p')}.",
                            'booking_id': b.id,
                            'status': b.status,
                            'is_pending_action': b.status == 'pending',
                            'created_at': evt.created_at.isoformat(),
                        })
                    else:
                        notifications.append({
                            'id': f"event-{evt.id}",
                            'type': 'booking_submitted',
                            'title': 'Appointment Requested',
                            'message': f"Your booking for {b.service.name} with {b.provider.display_name} has been submitted (Status: {b.status.capitalize()}).",
                            'booking_id': b.id,
                            'status': b.status,
                            'is_pending_action': False,
                            'created_at': evt.created_at.isoformat(),
                        })
                elif evt.event_type == 'confirmed':
                    notifications.append({
                        'id': f"event-{evt.id}",
                        'type': 'booking_confirmed',
                        'title': 'Appointment Confirmed',
                        'message': f"Appointment #{b.id} ({b.service.name}) is officially confirmed.",
                        'booking_id': b.id,
                        'status': 'confirmed',
                        'is_pending_action': False,
                        'created_at': evt.created_at.isoformat(),
                    })
                elif evt.event_type == 'rescheduled':
                    notifications.append({
                        'id': f"event-{evt.id}",
                        'type': 'booking_rescheduled',
                        'title': 'Appointment Rescheduled',
                        'message': f"Appointment #{b.id} has been moved to {b.start_at.strftime('%b %d, %Y at %I:%M %p')}.",
                        'booking_id': b.id,
                        'status': b.status,
                        'is_pending_action': False,
                        'created_at': evt.created_at.isoformat(),
                    })
                elif evt.event_type == 'cancelled':
                    notifications.append({
                        'id': f"event-{evt.id}",
                        'type': 'booking_cancelled',
                        'title': 'Appointment Cancelled',
                        'message': f"Appointment #{b.id} has been cancelled.",
                        'booking_id': b.id,
                        'status': b.status,
                        'is_pending_action': False,
                        'created_at': evt.created_at.isoformat(),
                    })
                elif evt.event_type == 'completed':
                    notifications.append({
                        'id': f"event-{evt.id}",
                        'type': 'booking_completed',
                        'title': 'Appointment Completed',
                        'message': f"Appointment #{b.id} ({b.service.name}) was marked as completed.",
                        'booking_id': b.id,
                        'status': 'completed',
                        'is_pending_action': False,
                        'created_at': evt.created_at.isoformat(),
                    })

            # 2. Reminders (Email / SMS scheduled & sent)
            reminders = Reminder.objects.filter(booking_id__in=booking_ids).order_by('-scheduled_for')[:15]
            for rem in reminders:
                b = booking_map.get(rem.booking_id)
                if not b:
                    continue
                notifications.append({
                    'id': f"rem-{rem.id}",
                    'type': 'reminder',
                    'title': f"Advance Reminder ({rem.status.capitalize()})",
                    'message': f"Automated {rem.channel.upper()} reminder for {b.service.name} set for {rem.scheduled_for.strftime('%b %d, %Y at %I:%M %p')}.",
                    'booking_id': b.id,
                    'status': rem.status,
                    'is_pending_action': False,
                    'created_at': (rem.sent_at or rem.created_at).isoformat(),
                })

        # 3. AI Waitlist Opening Alerts (Customer)
        try:
            from apps.ai_assistant.models import WaitlistEntry
            waitlist_alerts = WaitlistEntry.objects.filter(
                customer=user,
                is_notified=True
            ).select_related('provider', 'service').order_by('-notified_at')[:5]

            for w in waitlist_alerts:
                notifications.append({
                    'id': f"waitlist-{w.id}",
                    'type': 'booking_request',
                    'title': 'Early Opening Available!',
                    'message': f"A slot opened up with {w.provider.display_name} for {w.preferred_date.strftime('%b %d')}. Click to claim!",
                    'booking_id': None,
                    'provider_id': w.provider_id,
                    'status': 'available',
                    'is_pending_action': True,
                    'created_at': (w.notified_at or w.created_at).isoformat(),
                })
        except Exception:
            pass

        # 4. AI Post-Meeting Follow-up Emails (Customer)
        try:
            from apps.ai_assistant.models import MeetingFollowUp
            followups = MeetingFollowUp.objects.filter(
                booking__customer=user,
                is_sent=True
            ).select_related('booking', 'provider', 'booking__service').order_by('-sent_at')[:5]

            for f in followups:
                notifications.append({
                    'id': f"followup-{f.id}",
                    'type': 'booking_completed',
                    'title': f.email_subject,
                    'message': f"Meeting summary and action items sent by {f.provider.display_name}.",
                    'booking_id': f.booking_id,
                    'status': 'completed',
                    'is_pending_action': False,
                    'created_at': (f.sent_at or f.created_at).isoformat(),
                })
        except Exception:
            pass

        # Sort combined feed chronologically descending
        notifications.sort(key=lambda x: x['created_at'], reverse=True)

        # Unread count: items requiring pending action
        unread_count = sum(1 for n in notifications if n.get('is_pending_action'))

        return Response({
            'count': len(notifications),
            'unread_count': unread_count,
            'results': notifications[:25]
        }, status=status.HTTP_200_OK)


class BookingRemindersListView(generics.ListAPIView):
    """
    List reminders associated with a given booking.
    Accessible only to the customer or provider of that booking.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = ReminderSerializer

    def get_queryset(self):
        booking_id = self.kwargs['booking_id']
        user = self.request.user
        if user.role == 'admin':
            return Reminder.objects.filter(booking_id=booking_id)
        if user.role == 'provider':
            return Reminder.objects.filter(booking_id=booking_id, booking__provider__user=user)
        return Reminder.objects.filter(booking_id=booking_id, booking__customer=user)

