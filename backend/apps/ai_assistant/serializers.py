from rest_framework import serializers
from apps.ai_assistant.models import WaitlistEntry, BookingIntakeBrief, MeetingFollowUp


class AIConciergeQuerySerializer(serializers.Serializer):
    query = serializers.CharField(required=True, min_length=3, max_length=500)
    timezone = serializers.CharField(required=False, default='UTC')


class BookingIntakeBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = BookingIntakeBrief
        fields = (
            'id',
            'booking_id',
            'client_notes',
            'executive_summary',
            'agenda_items',
            'checklist',
            'created_at',
            'updated_at',
        )


class WaitlistEntrySerializer(serializers.ModelSerializer):
    provider_name = serializers.CharField(source='provider.display_name', read_only=True)
    service_name = serializers.CharField(source='service.name', read_only=True)

    class Meta:
        model = WaitlistEntry
        fields = (
            'id',
            'provider',
            'provider_name',
            'service',
            'service_name',
            'preferred_date',
            'time_window',
            'status',
            'is_notified',
            'notified_at',
            'created_at',
        )
        read_only_fields = ('id', 'status', 'is_notified', 'notified_at', 'created_at')


class WaitlistCreateSerializer(serializers.Serializer):
    provider_id = serializers.IntegerField(required=True)
    service_id = serializers.IntegerField(required=False, allow_null=True)
    preferred_date = serializers.DateField(required=True)
    time_window = serializers.ChoiceField(
        choices=WaitlistEntry.TIME_WINDOW_CHOICES,
        default='anytime'
    )


class MeetingFollowUpGenerateSerializer(serializers.Serializer):
    booking_id = serializers.IntegerField(required=True)
    rough_notes = serializers.CharField(required=False, allow_blank=True, default='')


class MeetingFollowUpSerializer(serializers.ModelSerializer):
    class Meta:
        model = MeetingFollowUp
        fields = (
            'id',
            'booking_id',
            'rough_notes',
            'email_subject',
            'email_body',
            'action_items',
            'is_sent',
            'sent_at',
            'created_at',
            'updated_at',
        )
