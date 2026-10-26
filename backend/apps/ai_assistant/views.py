from rest_framework import status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.generics import get_object_or_404
from apps.scheduling.models import Booking
from apps.ai_assistant.models import WaitlistEntry, BookingIntakeBrief, MeetingFollowUp
from apps.ai_assistant.serializers import (
    AIConciergeQuerySerializer,
    BookingIntakeBriefSerializer,
    WaitlistEntrySerializer,
    WaitlistCreateSerializer,
    MeetingFollowUpGenerateSerializer,
    MeetingFollowUpSerializer,
)
from apps.ai_assistant.services import (
    AIConciergeService,
    AIIntakeBriefService,
    AIWaitlistService,
    AIMeetingFollowUpService,
)


class AIConciergeView(APIView):
    """
    Public conversational scheduling assistant.
    Parses natural language requests and returns conflict-free slot recommendations.
    """
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = AIConciergeQuerySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        query = serializer.validated_data['query']
        tz_str = serializer.validated_data.get('timezone', 'UTC')

        try:
            result = AIConciergeService.process_query(query, customer_tz_str=tz_str)
            return Response(result, status=status.HTTP_200_OK)
        except ValueError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response(
                {'detail': f"Unable to parse scheduling query: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class BookingIntakeBriefView(APIView):
    """
    Retrieves or generates an AI Executive Consultation Brief for a booking.
    Accessible to assigned provider, customer, or admin.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, booking_id):
        booking = get_object_or_404(Booking, id=booking_id)
        if request.user.role != 'admin' and booking.provider.user != request.user and booking.customer != request.user:
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

        brief = AIIntakeBriefService.generate_or_get_brief(booking)
        serializer = BookingIntakeBriefSerializer(brief)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, booking_id):
        booking = get_object_or_404(Booking, id=booking_id)
        if request.user.role != 'admin' and booking.provider.user != request.user:
            return Response({'detail': 'Only assigned provider can regenerate briefing.'}, status=status.HTTP_403_FORBIDDEN)

        # Allow passing updated intake notes if requested
        updated_notes = request.data.get('client_notes')
        if updated_notes is not None:
            booking.intake_notes = updated_notes
            booking.save(update_fields=['intake_notes'])

        brief = AIIntakeBriefService.generate_or_get_brief(booking)
        serializer = BookingIntakeBriefSerializer(brief)
        return Response(serializer.data, status=status.HTTP_200_OK)


class WaitlistListView(APIView):
    """
    View active waitlist registrations and register for high-demand slot notifications.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role == 'provider':
            entries = WaitlistEntry.objects.filter(provider__user=request.user).select_related('provider', 'service', 'customer')
        else:
            entries = WaitlistEntry.objects.filter(customer=request.user).select_related('provider', 'service')

        serializer = WaitlistEntrySerializer(entries, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = WaitlistCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            entry = AIWaitlistService.register_waitlist(
                customer=request.user,
                provider_id=data['provider_id'],
                service_id=data.get('service_id'),
                preferred_date=data['preferred_date'],
                time_window=data.get('time_window', 'anytime')
            )
            return Response(
                WaitlistEntrySerializer(entry).data,
                status=status.HTTP_201_CREATED
            )
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class MeetingFollowUpGenerateView(APIView):
    """
    Generates or refreshes a structured post-meeting follow-up email draft and action items.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = MeetingFollowUpGenerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        booking = get_object_or_404(Booking, id=data['booking_id'])
        if request.user.role != 'admin' and booking.provider.user != request.user:
            return Response({'detail': 'Only assigned provider can generate post-meeting follow-ups.'}, status=status.HTTP_403_FORBIDDEN)

        followup = AIMeetingFollowUpService.generate_followup(
            booking=booking,
            rough_notes=data.get('rough_notes', '')
        )
        return Response(MeetingFollowUpSerializer(followup).data, status=status.HTTP_200_OK)


class MeetingFollowUpSendView(APIView):
    """
    Dispatches the generated follow-up email to the customer and finalizes completion.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, followup_id):
        followup = get_object_or_404(MeetingFollowUp, id=followup_id)
        if request.user.role != 'admin' and followup.provider.user != request.user:
            return Response({'detail': 'Only assigned provider can send follow-up emails.'}, status=status.HTTP_403_FORBIDDEN)

        sent = AIMeetingFollowUpService.send_followup(followup_id, request.user)
        return Response(
            {
                'status': 'sent',
                'sent_at': sent.sent_at.isoformat(),
                'message': f"Follow-up email successfully sent to {sent.booking.customer.email}."
            },
            status=status.HTTP_200_OK
        )
