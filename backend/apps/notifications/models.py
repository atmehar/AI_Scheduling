from django.db import models
from apps.scheduling.models import Booking


class Reminder(models.Model):
    """
    Queue table storing scheduled notification reminders for upcoming appointments.
    Processed safely by concurrent workers using PostgreSQL SKIP LOCKED.
    """
    CHANNEL_CHOICES = (
        ('email', 'Email'),
        ('sms', 'SMS'),
    )

    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('sent', 'Sent'),
        ('failed', 'Failed'),
        ('cancelled', 'Cancelled'),
    )

    booking = models.ForeignKey(
        Booking,
        on_delete=models.CASCADE,
        related_name='reminders'
    )
    channel = models.CharField(
        max_length=20,
        choices=CHANNEL_CHOICES,
        default='email'
    )
    scheduled_for = models.DateTimeField(db_index=True)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending',
        db_index=True
    )
    attempts = models.PositiveIntegerField(default=0)
    max_attempts = models.PositiveIntegerField(default=3)
    last_error = models.TextField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'reminders'
        ordering = ['scheduled_for']
        constraints = [
            models.UniqueConstraint(
                fields=['booking', 'channel', 'scheduled_for'],
                name='uq_booking_channel_scheduled'
            ),
        ]
        indexes = [
            models.Index(
                fields=['status', 'scheduled_for'],
                name='idx_reminders_status_sched'
            ),
        ]

    def __str__(self):
        return (
            f"Reminder #{self.id} for Booking #{self.booking_id} "
            f"via {self.channel} at {self.scheduled_for} [{self.status}]"
        )
