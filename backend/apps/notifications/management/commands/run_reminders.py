from datetime import timedelta
import logging
import time
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from apps.notifications.models import Reminder
from apps.notifications.services.mock_provider import MockNotificationProvider

logger = logging.getLogger(__name__)


def process_due_reminders(batch_size=50, simulate_failure=False):
    """
    Atomically selects due reminders using PostgreSQL SKIP LOCKED to prevent
    thread/worker contention, dispatches notifications, and handles exponential retries.
    Returns the count of successfully sent reminders.
    """
    now = timezone.now()
    processed_count = 0

    with transaction.atomic():
        # Atomically lock due reminders that are not locked by other workers
        due_reminders = list(
            Reminder.objects.filter(
                status='pending',
                scheduled_for__lte=now
            )
            .select_related('booking__customer', 'booking__provider', 'booking__service')
            .select_for_update(skip_locked=True)[:batch_size]
        )

        for reminder in due_reminders:
            # Duplicate-send defense: if already marked sent, skip immediately
            if reminder.sent_at is not None:
                reminder.status = 'sent'
                reminder.save(update_fields=['status'])
                continue

            reminder.status = 'processing'
            reminder.attempts += 1
            reminder.save(update_fields=['status', 'attempts'])

            try:
                # Dispatch notification through the mock provider
                MockNotificationProvider.send_notification(
                    reminder=reminder,
                    simulate_failure=simulate_failure
                )
                reminder.status = 'sent'
                reminder.sent_at = timezone.now()
                reminder.save(update_fields=['status', 'sent_at'])
                processed_count += 1

            except Exception as exc:
                reminder.last_error = str(exc)
                logger.error("Reminder #%s failed: %s", reminder.id, exc)

                if reminder.attempts >= reminder.max_attempts:
                    reminder.status = 'failed'
                else:
                    # Exponential backoff: 2^attempts * 60 seconds
                    backoff_seconds = (2 ** reminder.attempts) * 60
                    reminder.scheduled_for = timezone.now() + timedelta(seconds=backoff_seconds)
                    reminder.status = 'pending'

                reminder.save(update_fields=['status', 'last_error', 'scheduled_for'])

    return processed_count


class Command(BaseCommand):
    help = "Run the asynchronous appointment reminders background queue worker with SKIP LOCKED."

    def add_arguments(self, parser):
        parser.add_argument(
            '--once',
            action='store_true',
            help='Process a single batch of due reminders and terminate.'
        )
        parser.add_argument(
            '--batch-size',
            type=int,
            default=50,
            help='Maximum number of reminders to claim and process per batch.'
        )
        parser.add_argument(
            '--poll-interval',
            type=int,
            default=5,
            help='Seconds to sleep between batch polling cycles in continuous daemon mode.'
        )

    def handle(self, *args, **options):
        once = options['once']
        batch_size = options['batch_size']
        poll_interval = options['poll_interval']

        self.stdout.write(
            self.style.SUCCESS(
                f"Starting Reminders Background Queue Worker (batch_size={batch_size}, once={once})..."
            )
        )

        if once:
            count = process_due_reminders(batch_size=batch_size)
            self.stdout.write(
                self.style.SUCCESS(f"Finished processing batch. Sent {count} reminders.")
            )
            return

        # Continuous daemon mode
        try:
            while True:
                count = process_due_reminders(batch_size=batch_size)
                if count > 0:
                    self.stdout.write(f"Processed and sent {count} due reminders.")
                time.sleep(poll_interval)
        except KeyboardInterrupt:
            self.stdout.write(self.style.WARNING("Worker stopped by user."))
