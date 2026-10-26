from datetime import timedelta
from django.utils import timezone
from apps.notifications.models import Reminder


class ReminderService:
    """
    Manages the lifecycle of appointment reminders:
    - Schedules 24-hour and 1-hour advance reminders upon booking confirmation
    - Cancels pending reminders when an appointment is cancelled
    - Atomically updates and reschedules reminders when an appointment is rescheduled
    """

    @classmethod
    def schedule_booking_reminders(cls, booking):
        """
        Schedules advance notification reminders for an active booking.
        """
        if booking.status not in ('pending', 'confirmed'):
            return []

        now_utc = timezone.now()
        reminders_to_create = []

        # 24 hours before appointment
        t_24h = booking.start_at - timedelta(hours=24)
        if t_24h > now_utc:
            reminders_to_create.append(t_24h)

        # 1 hour before appointment
        t_1h = booking.start_at - timedelta(hours=1)
        if t_1h > now_utc:
            reminders_to_create.append(t_1h)

        # If both target times are in the past (e.g. booked for 45 mins from now),
        # schedule a prompt reminder 2 minutes from now
        if not reminders_to_create and booking.start_at > now_utc:
            reminders_to_create.append(now_utc + timedelta(minutes=2))

        created_instances = []
        for scheduled_time in reminders_to_create:
            reminder, created = Reminder.objects.get_or_create(
                booking=booking,
                channel='email',
                scheduled_for=scheduled_time,
                defaults={'status': 'pending'}
            )
            created_instances.append(reminder)

        return created_instances

    @classmethod
    def cancel_booking_reminders(cls, booking):
        """
        Cancels all pending reminders for a cancelled or invalidated booking.
        """
        updated_count = Reminder.objects.filter(
            booking=booking,
            status__in=['pending', 'processing']
        ).update(status='cancelled')
        return updated_count

    @classmethod
    def reschedule_booking_reminders(cls, booking):
        """
        Cancels existing pending reminders and schedules fresh ones for the new time.
        """
        cls.cancel_booking_reminders(booking)
        return cls.schedule_booking_reminders(booking)
