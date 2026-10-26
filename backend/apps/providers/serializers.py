import zoneinfo
from rest_framework import serializers
from apps.providers.models import Provider, Service, TimeOff, WorkingHour


class ServiceSerializer(serializers.ModelSerializer):
    """
    Serializer for managing services offered by the provider.
    """
    class Meta:
        model = Service
        fields = (
            'id',
            'name',
            'duration_minutes',
            'buffer_minutes',
            'price_amount',
            'currency',
            'is_active',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('id', 'created_at', 'updated_at')

    def validate_duration_minutes(self, value):
        if value <= 0:
            raise serializers.ValidationError("Duration must be greater than 0 minutes.")
        return value

    def validate_buffer_minutes(self, value):
        if value < 0:
            raise serializers.ValidationError("Buffer cannot be negative.")
        return value

    def validate_price_amount(self, value):
        if value < 0:
            raise serializers.ValidationError("Price cannot be negative.")
        return value


class WorkingHourSerializer(serializers.ModelSerializer):
    """
    Serializer for weekly working hours schedule.
    """
    weekday_display = serializers.CharField(source='get_weekday_display', read_only=True)

    class Meta:
        model = WorkingHour
        fields = (
            'id',
            'weekday',
            'weekday_display',
            'start_time',
            'end_time',
        )
        read_only_fields = ('id', 'weekday_display')

    def validate(self, attrs):
        start_time = attrs.get('start_time')
        end_time = attrs.get('end_time')
        if start_time and end_time and end_time <= start_time:
            raise serializers.ValidationError({"end_time": "End time must be strictly after start time."})
        return attrs


class TimeOffSerializer(serializers.ModelSerializer):
    """
    Serializer for provider vacation and blackout dates in UTC.
    """
    class Meta:
        model = TimeOff
        fields = (
            'id',
            'start_at',
            'end_at',
            'reason',
            'created_at',
        )
        read_only_fields = ('id', 'created_at')

    def validate(self, attrs):
        start_at = attrs.get('start_at')
        end_at = attrs.get('end_at')
        if start_at and end_at and end_at <= start_at:
            raise serializers.ValidationError({"end_at": "End time must be strictly after start time."})
        return attrs


class ProviderProfileSerializer(serializers.ModelSerializer):
    """
    Serializer for viewing and updating the provider's business profile.
    """
    email = serializers.EmailField(source='user.email', read_only=True)

    class Meta:
        model = Provider
        fields = (
            'id',
            'email',
            'display_name',
            'bio',
            'timezone',
            'min_notice_minutes',
            'cancellation_hours',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('id', 'email', 'created_at', 'updated_at')

    def validate_timezone(self, value):
        if value not in zoneinfo.available_timezones():
            raise serializers.ValidationError(
                f"'{value}' is not a valid IANA timezone (e.g. 'Asia/Karachi', 'America/New_York')."
            )
        return value


class PublicProviderListSerializer(serializers.ModelSerializer):
    """
    Lightweight public serializer for provider search and directory listings.
    """
    active_services_count = serializers.SerializerMethodField()

    class Meta:
        model = Provider
        fields = (
            'id',
            'display_name',
            'bio',
            'timezone',
            'min_notice_minutes',
            'cancellation_hours',
            'active_services_count',
        )

    def get_active_services_count(self, obj):
        return obj.services.filter(is_active=True).count()


class PublicProviderDetailSerializer(serializers.ModelSerializer):
    """
    Comprehensive public serializer for a provider's public booking page,
    including their active services and weekly working hours.
    """
    services = serializers.SerializerMethodField()
    working_hours = WorkingHourSerializer(many=True, read_only=True)

    class Meta:
        model = Provider
        fields = (
            'id',
            'display_name',
            'bio',
            'timezone',
            'min_notice_minutes',
            'cancellation_hours',
            'services',
            'working_hours',
        )

    def get_services(self, obj):
        active_services = obj.services.filter(is_active=True)
        return ServiceSerializer(active_services, many=True).data
