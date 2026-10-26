from django.conf import settings
from django.db import models
from apps.core.models import TimeStampedModel
from apps.providers.models import Provider, Service
from apps.scheduling.models import Booking


class WaitlistEntry(TimeStampedModel):
    """
    Tracks client waitlist preferences for full days or high-demand providers.
    Enables instant slot recovery when cancellations occur.
    """
    TIME_WINDOW_CHOICES = (
        ('anytime', 'Any Time'),
        ('morning', 'Morning (8 AM - 12 PM)'),
        ('afternoon', 'Afternoon (12 PM - 5 PM)'),
        ('evening', 'Evening (5 PM - 9 PM)'),
    )
    STATUS_CHOICES = (
        ('active', 'Active'),
        ('notified', 'Notified'),
        ('claimed', 'Claimed'),
        ('expired', 'Expired'),
        ('cancelled', 'Cancelled'),
    )

    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='waitlist_entries'
    )
    provider = models.ForeignKey(
        Provider,
        on_delete=models.CASCADE,
        related_name='waitlist_entries'
    )
    service = models.ForeignKey(
        Service,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='waitlist_entries'
    )
    preferred_date = models.DateField(db_index=True)
    time_window = models.CharField(
        max_length=20,
        choices=TIME_WINDOW_CHOICES,
        default='anytime'
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='active',
        db_index=True
    )
    is_notified = models.BooleanField(default=False)
    notified_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'ai_waitlist_entries'
        ordering = ['-created_at']

    def __str__(self):
        return f"Waitlist: {self.customer.email} -> {self.provider.display_name} on {self.preferred_date} ({self.status})"


class BookingIntakeBrief(TimeStampedModel):
    """
    AI-generated consultation briefing for providers based on client intake notes.
    """
    booking = models.OneToOneField(
        Booking,
        on_delete=models.CASCADE,
        related_name='intake_brief'
    )
    client_notes = models.TextField(blank=True, default='')
    executive_summary = models.TextField()
    agenda_items = models.JSONField(default=list)
    checklist = models.JSONField(default=list)

    class Meta:
        db_table = 'ai_intake_briefs'

    def __str__(self):
        return f"Intake Brief for Booking #{self.booking_id}"


class MeetingFollowUp(TimeStampedModel):
    """
    Post-consultation follow-up summary, action items with deadlines, and draft email.
    """
    booking = models.OneToOneField(
        Booking,
        on_delete=models.CASCADE,
        related_name='followup'
    )
    provider = models.ForeignKey(
        Provider,
        on_delete=models.CASCADE,
        related_name='meeting_followups'
    )
    rough_notes = models.TextField(blank=True, default='')
    email_subject = models.CharField(max_length=255)
    email_body = models.TextField()
    action_items = models.JSONField(default=list)
    is_sent = models.BooleanField(default=False)
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'ai_meeting_followups'

    def __str__(self):
        return f"FollowUp for Booking #{self.booking_id} (Sent: {self.is_sent})"
