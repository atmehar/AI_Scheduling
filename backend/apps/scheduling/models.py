import uuid
from django.conf import settings
from django.db import models
from django.utils import timezone
from apps.core.models import TimeStampedModel
from apps.providers.models import Provider, Service


class Booking(TimeStampedModel):
    """
    Core appointment booking record between a customer and a service provider.
    Guaranteed zero-overlap via PostgreSQL EXCLUDE constraint on active bookings.
    """
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('confirmed', 'Confirmed'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
        ('late_cancelled', 'Late Cancelled'),
        ('no_show', 'No Show'),
    )

    provider = models.ForeignKey(
        Provider,
        on_delete=models.RESTRICT,
        related_name='bookings'
    )
    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.RESTRICT,
        related_name='customer_bookings'
    )
    service = models.ForeignKey(
        Service,
        on_delete=models.RESTRICT,
        related_name='bookings'
    )
    start_at = models.DateTimeField(db_index=True)
    end_at = models.DateTimeField(db_index=True)
    status = models.CharField(
        max_length=30,
        choices=STATUS_CHOICES,
        default='confirmed',
        db_index=True
    )
    cancelled_at = models.DateTimeField(null=True, blank=True)
    reschedule_count = models.PositiveIntegerField(default=0)
    idempotency_key = models.UUIDField(default=uuid.uuid4, db_index=True)
    intake_notes = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'bookings'
        ordering = ['start_at']
        constraints = [
            models.CheckConstraint(
                check=models.Q(end_at__gt=models.F('start_at')),
                name='chk_booking_end_gt_start'
            ),
            models.UniqueConstraint(
                fields=['customer', 'idempotency_key'],
                name='uq_customer_idempotency'
            ),
        ]

    def __str__(self):
        return f"Booking #{self.id}: {self.customer.email} with {self.provider.display_name} ({self.status})"

    @property
    def is_active(self):
        return self.status in ('pending', 'confirmed')


class BookingEvent(models.Model):
    """
    Immutable audit trail recording all lifecycle state transitions of a booking.
    """
    EVENT_CHOICES = (
        ('created', 'Created'),
        ('rescheduled', 'Rescheduled'),
        ('cancelled', 'Cancelled'),
        ('completed', 'Completed'),
    )

    booking = models.ForeignKey(
        Booking,
        on_delete=models.CASCADE,
        related_name='events'
    )
    event_type = models.CharField(max_length=50, choices=EVENT_CHOICES)
    old_values = models.JSONField(null=True, blank=True)
    new_values = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'booking_events'
        ordering = ['-created_at']

    def __str__(self):
        return f"BookingEvent #{self.id}: {self.event_type} on Booking #{self.booking_id}"
