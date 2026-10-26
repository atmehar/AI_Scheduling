from rest_framework import serializers
from apps.notifications.models import Reminder


class ReminderSerializer(serializers.ModelSerializer):
    """
    Serializer for viewing appointment reminder status.
    """
    class Meta:
        model = Reminder
        fields = (
            'id',
            'booking_id',
            'channel',
            'scheduled_for',
            'status',
            'attempts',
            'sent_at',
            'created_at',
        )
        read_only_fields = fields
