import uuid
from rest_framework import serializers
from apps.accounts.serializers import UserDetailSerializer
from apps.providers.models import Provider, Service
from apps.scheduling.models import Booking, BookingEvent


class BookingEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = BookingEvent
        fields = ('id', 'event_type', 'old_values', 'new_values', 'created_at')


class BookingServiceNestedSerializer(serializers.ModelSerializer):
    class Meta:
        model = Service
        fields = ('id', 'name', 'duration_minutes', 'buffer_minutes', 'price_amount', 'currency')


class BookingProviderNestedSerializer(serializers.ModelSerializer):
    class Meta:
        model = Provider
        fields = ('id', 'display_name', 'timezone', 'min_notice_minutes', 'cancellation_hours')


class BookingDetailSerializer(serializers.ModelSerializer):
    """
    Detailed representation of a booking with nested customer, provider, and service.
    """
    provider = BookingProviderNestedSerializer(read_only=True)
    service = BookingServiceNestedSerializer(read_only=True)
    customer = UserDetailSerializer(read_only=True)
    events = BookingEventSerializer(many=True, read_only=True)

    class Meta:
        model = Booking
        fields = (
            'id',
            'provider',
            'service',
            'customer',
            'start_at',
            'end_at',
            'status',
            'cancelled_at',
            'reschedule_count',
            'idempotency_key',
            'intake_notes',
            'created_at',
            'updated_at',
            'events',
        )
        read_only_fields = fields


class BookingCreateSerializer(serializers.Serializer):
    """
    Payload for creating a new appointment booking.
    """
    provider_id = serializers.IntegerField(required=True)
    service_id = serializers.IntegerField(required=True)
    start_at = serializers.DateTimeField(required=True)
    intake_notes = serializers.CharField(required=False, allow_blank=True, default='')

    def validate_provider_id(self, value):
        if not Provider.objects.filter(id=value).exists():
            raise serializers.ValidationError("Provider does not exist.")
        return value

    def validate_service_id(self, value):
        if not Service.objects.filter(id=value).exists():
            raise serializers.ValidationError("Service does not exist.")
        return value


class BookingRescheduleSerializer(serializers.Serializer):
    """
    Payload for rescheduling an existing booking.
    """
    new_start_at = serializers.DateTimeField(required=True)


class BookingCancelSerializer(serializers.Serializer):
    """
    Payload for cancelling an appointment.
    """
    reason = serializers.CharField(max_length=255, required=False, allow_blank=True, default='')


class SlotQuerySerializer(serializers.Serializer):
    """
    Query parameters for generating dynamic available slots.
    """
    service_id = serializers.IntegerField(required=True)
    from_date = serializers.DateField(required=True)
    to_date = serializers.DateField(required=True)
    tz = serializers.CharField(required=False, default=None, allow_null=True)

    def validate(self, attrs):
        from_date = attrs.get('from_date')
        to_date = attrs.get('to_date')
        if from_date and to_date and to_date < from_date:
            raise serializers.ValidationError({"to_date": "'to_date' must be on or after 'from_date'."})
        return attrs
