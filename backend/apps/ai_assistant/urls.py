from django.urls import path
from apps.ai_assistant.views import (
    AIConciergeView,
    BookingIntakeBriefView,
    WaitlistListView,
    MeetingFollowUpGenerateView,
    MeetingFollowUpSendView,
)

urlpatterns = [
    # Feature 1: Natural Language Smart Booking Concierge
    path('concierge/', AIConciergeView.as_view(), name='ai-concierge'),

    # Feature 2: Automated Client Intake & Pre-Meeting Briefing
    path('intake-brief/<int:booking_id>/', BookingIntakeBriefView.as_view(), name='ai-intake-brief'),

    # Feature 3: Smart Waitlist Registration & Active Standby List
    path('waitlist/', WaitlistListView.as_view(), name='ai-waitlist'),

    # Feature 4: Post-Meeting Action Items & Follow-up Generator
    path('meeting-followup/', MeetingFollowUpGenerateView.as_view(), name='ai-meeting-followup-generate'),
    path('meeting-followup/generate/', MeetingFollowUpGenerateView.as_view(), name='ai-meeting-followup-generate-alias'),
    path('meeting-followup/<int:followup_id>/send/', MeetingFollowUpSendView.as_view(), name='ai-meeting-followup-send'),
]
