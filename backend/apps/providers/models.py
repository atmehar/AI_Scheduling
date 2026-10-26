import zoneinfo
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from apps.core.models import TimeStampedModel


def validate_iana_timezone(value):
    """
    Validates that the provided timezone string is a recognized IANA timezone.
    """
    if value not in zoneinfo.available_timezones():
        raise ValidationError(f"'{value}' is not a valid IANA timezone (e.g. 'Asia/Karachi', 'America/New_York').")


class Provider(TimeStampedModel):
    """
    Profile extension for users who operate as service providers.
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='provider_profile'
    )
    display_name = models.CharField(max_length=255)
    bio = models.TextField(blank=True, default='')
    timezone = models.CharField(
        max_length=64,
        default='UTC',
        validators=[validate_iana_timezone]
    )
    min_notice_minutes = models.PositiveIntegerField(
        default=60,
        help_text="Minimum notice required in minutes before a slot can be booked."
    )
    cancellation_hours = models.PositiveIntegerField(
        default=24,
        help_text="Hours before appointment where cancellation is free. Later cancellations are late_cancelled."
    )

    class Meta:
        db_table = 'providers'
        ordering = ['display_name']

    def __str__(self):
        return f"{self.display_name} ({self.timezone})"


class Service(TimeStampedModel):
    """
    Services offered by a provider with specific duration and turnaround buffer.
    """
    provider = models.ForeignKey(
        Provider,
        on_delete=models.CASCADE,
        related_name='services'
    )
    name = models.CharField(max_length=255)
    duration_minutes = models.PositiveIntegerField(
        help_text="Duration of the appointment session in minutes."
    )
    buffer_minutes = models.PositiveIntegerField(
        default=0,
        help_text="Turnaround / sanitation buffer after the session in minutes."
    )
    price_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0.00
    )
    currency = models.CharField(max_length=3, default='USD')
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'services'
        ordering = ['name']
        constraints = [
            models.CheckConstraint(
                check=models.Q(duration_minutes__gt=0),
                name='chk_service_duration_gt_zero'
            ),
            models.CheckConstraint(
                check=models.Q(price_amount__gte=0),
                name='chk_service_price_gte_zero'
            ),
        ]

    def __str__(self):
        return f"{self.name} ({self.duration_minutes}m + {self.buffer_minutes}m buffer)"


class WorkingHour(models.Model):
    """
    Weekly recurring operational schedule in provider's local timezone.
    0 = Monday, 1 = Tuesday, ..., 6 = Sunday.
    """
    WEEKDAY_CHOICES = (
        (0, 'Monday'),
        (1, 'Tuesday'),
        (2, 'Wednesday'),
        (3, 'Thursday'),
        (4, 'Friday'),
        (5, 'Saturday'),
        (6, 'Sunday'),
    )

    provider = models.ForeignKey(
        Provider,
        on_delete=models.CASCADE,
        related_name='working_hours'
    )
    weekday = models.SmallIntegerField(choices=WEEKDAY_CHOICES)
    start_time = models.TimeField()
    end_time = models.TimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'working_hours'
        ordering = ['weekday', 'start_time']
        constraints = [
            models.CheckConstraint(
                check=models.Q(weekday__gte=0) & models.Q(weekday__lte=6),
                name='chk_working_hours_weekday_range'
            ),
            models.CheckConstraint(
                check=models.Q(end_time__gt=models.F('start_time')),
                name='chk_working_hours_end_gt_start'
            ),
        ]

    def __str__(self):
        return f"{self.provider.display_name}: Day {self.weekday} ({self.start_time} - {self.end_time})"


class TimeOff(models.Model):
    """
    Blackout dates or vacation ranges stored in UTC.
    """
    provider = models.ForeignKey(
        Provider,
        on_delete=models.CASCADE,
        related_name='time_off_blocks'
    )
    start_at = models.DateTimeField()
    end_at = models.DateTimeField()
    reason = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'time_off'
        ordering = ['start_at']
        constraints = [
            models.CheckConstraint(
                check=models.Q(end_at__gt=models.F('start_at')),
                name='chk_time_off_end_gt_start'
            ),
        ]

    def __str__(self):
        return f"{self.provider.display_name}: Time-Off from {self.start_at} to {self.end_at} ({self.reason})"
