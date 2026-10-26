from datetime import timedelta
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone
from apps.scheduling.models import Booking, BookingEvent


class BookingService:
    """
    Encapsulates all core transaction-safe booking operations:
    - Atomic booking creation with idempotency defense
    - Atomic rescheduling with automatic rollback on collision
    - Policy-enforced cancellation (free vs late cancelled)
    - Appointment completion
    """

    @staticmethod
    def create_booking(customer, provider, service, start_at, idempotency_key, intake_notes=''):
        """
        Atomically creates a new booking. If a booking with the same idempotency_key
        already exists for this customer, the existing booking is returned idempotently.
        """
        # 1. Check Idempotency first (outside atomic write)
        existing = Booking.objects.filter(
            customer=customer,
            idempotency_key=idempotency_key
        ).first()
        if existing:
            return existing, False

        # 2. Validations
        if service.provider_id != provider.id:
            raise ValidationError("The requested service does not belong to this provider.")

        if not service.is_active:
            raise ValidationError("The selected service is currently inactive.")

        now_utc = timezone.now()
        min_notice_delta = timedelta(minutes=provider.min_notice_minutes)
        if start_at < (now_utc + min_notice_delta):
            raise ValidationError(
                f"Booking requires at least {provider.min_notice_minutes} minutes notice."
            )

        end_at = start_at + timedelta(minutes=service.duration_minutes)

        # 3. Atomic creation (starts in 'pending' status awaiting provider acceptance)
        with transaction.atomic():
            booking = Booking.objects.create(
                customer=customer,
                provider=provider,
                service=service,
                start_at=start_at,
                end_at=end_at,
                status='pending',
                idempotency_key=idempotency_key,
                intake_notes=intake_notes
            )

            BookingEvent.objects.create(
                booking=booking,
                event_type='created',
                new_values={
                    'status': 'pending',
                    'start_at': start_at.isoformat(),
                    'end_at': end_at.isoformat(),
                    'service_id': service.id
                }
            )

        return booking, True

    @staticmethod
    def accept_booking(booking_id, provider_user):
        """
        Provider accepts an incoming pending booking request.
        Transitions status from 'pending' to 'confirmed' and schedules reminders.
        """
        with transaction.atomic():
            booking = Booking.objects.select_for_update().get(id=booking_id)

            if provider_user.role != 'admin' and booking.provider.user_id != provider_user.id:
                raise ValidationError("Only the assigned provider can accept this booking.")

            if booking.status != 'pending':
                raise ValidationError(f"Cannot accept a booking with status '{booking.status}'. It must be 'pending'.")

            booking.status = 'confirmed'
            booking.save(update_fields=['status'])

            BookingEvent.objects.create(
                booking=booking,
                event_type='confirmed',
                new_values={'status': 'confirmed'}
            )

            # Schedule automated reminders upon acceptance
            from apps.notifications.services.reminder_service import ReminderService
            ReminderService.schedule_booking_reminders(booking)

        return booking

    @staticmethod
    def reschedule_booking(booking_id, new_start_at, user):
        """
        Atomically reschedules an existing booking to a new start time.
        If the target slot conflicts with another booking, the transaction rolls back
        and the original booking is preserved untouched.
        """
        with transaction.atomic():
            booking = Booking.objects.select_for_update().get(id=booking_id)

            # Verification of permission
            if user.role != 'admin' and booking.customer_id != user.id and booking.provider.user_id != user.id:
                raise ValidationError("You do not have permission to reschedule this booking.")

            # Validate current status
            if booking.status not in ('pending', 'confirmed'):
                raise ValidationError(f"Cannot reschedule a booking with status '{booking.status}'.")

            now_utc = timezone.now()
            min_notice_delta = timedelta(minutes=booking.provider.min_notice_minutes)
            if new_start_at < (now_utc + min_notice_delta):
                raise ValidationError(
                    f"New appointment time must be at least {booking.provider.min_notice_minutes} minutes in the future."
                )

            old_start = booking.start_at
            old_end = booking.end_at
            new_end_at = new_start_at + timedelta(minutes=booking.service.duration_minutes)

            booking.start_at = new_start_at
            booking.end_at = new_end_at
            booking.reschedule_count += 1
            booking.save()

            BookingEvent.objects.create(
                booking=booking,
                event_type='rescheduled',
                old_values={'start_at': old_start.isoformat(), 'end_at': old_end.isoformat()},
                new_values={'start_at': new_start_at.isoformat(), 'end_at': new_end_at.isoformat()}
            )

            # Update scheduled reminders for the new timing
            from apps.notifications.services.reminder_service import ReminderService
            ReminderService.reschedule_booking_reminders(booking)

        return booking

    @staticmethod
    def cancel_booking(booking_id, user, reason=''):
        """
        Cancels a booking according to the provider's cancellation policy.
        If cancelled before the cancellation threshold, marks as 'cancelled'.
        If cancelled late, marks as 'late_cancelled'.
        In both cases, active status is cleared and the slot is freed.
        """
        with transaction.atomic():
            booking = Booking.objects.select_for_update().get(id=booking_id)

            if user.role != 'admin' and booking.customer_id != user.id and booking.provider.user_id != user.id:
                raise ValidationError("You do not have permission to cancel this booking.")

            if booking.status not in ('pending', 'confirmed'):
                raise ValidationError(f"Cannot cancel a booking with status '{booking.status}'.")

            now_utc = timezone.now()
            free_cancel_window = timedelta(hours=booking.provider.cancellation_hours)
            time_until_start = booking.start_at - now_utc

            is_late = time_until_start < free_cancel_window
            new_status = 'late_cancelled' if is_late else 'cancelled'
            old_status = booking.status

            booking.status = new_status
            booking.cancelled_at = now_utc
            booking.save()

            BookingEvent.objects.create(
                booking=booking,
                event_type='cancelled',
                old_values={'status': old_status},
                new_values={'status': new_status, 'is_late': is_late, 'reason': reason}
            )

            # Cancel pending reminders
            from apps.notifications.services.reminder_service import ReminderService
            ReminderService.cancel_booking_reminders(booking)

        return booking, is_late

    @staticmethod
    def complete_booking(booking_id, provider_user):
        """
        Marks an appointment as completed. Can only be performed by the provider or admin.
        """
        with transaction.atomic():
            booking = Booking.objects.select_for_update().get(id=booking_id)

            if provider_user.role != 'admin' and booking.provider.user_id != provider_user.id:
                raise ValidationError("Only the service provider can mark this booking as completed.")

            if booking.status != 'confirmed':
                raise ValidationError("Only confirmed bookings can be marked as completed.")

            booking.status = 'completed'
            booking.save()

            BookingEvent.objects.create(
                booking=booking,
                event_type='completed',
                old_values={'status': 'confirmed'},
                new_values={'status': 'completed'}
            )

        return booking
