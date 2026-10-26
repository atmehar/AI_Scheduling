import uuid
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from apps.providers.models import Provider, Service
from apps.scheduling.models import Booking
from apps.scheduling.permissions import IsBookingParticipant, IsBookingProvider
from apps.scheduling.serializers import (
    BookingCancelSerializer,
    BookingCreateSerializer,
    BookingDetailSerializer,
    BookingRescheduleSerializer,
    SlotQuerySerializer,
)
from apps.scheduling.services.booking_service import BookingService
from apps.scheduling.services.slot_generator import generate_available_slots


class ProviderSlotsView(APIView):
    """
    Public dynamic slot generation endpoint.
    Computes available appointment slots considering working hours, buffers,
    time-off blocks, existing active bookings, and minimum notice.
    """
    permission_classes = [AllowAny]

    def get(self, request, provider_id):
        provider = generics.get_object_or_404(Provider, id=provider_id)

        # Map query params (supports ?from=2026-11-01&to=2026-11-07 or ?from_date=...&to_date=...)
        raw_params = {
            'service_id': request.query_params.get('service_id'),
            'from_date': request.query_params.get('from') or request.query_params.get('from_date'),
            'to_date': request.query_params.get('to') or request.query_params.get('to_date'),
            'tz': request.query_params.get('tz'),
        }

        query_serializer = SlotQuerySerializer(data=raw_params)
        query_serializer.is_valid(raise_exception=True)
        validated = query_serializer.validated_data

        service = generics.get_object_or_404(
            Service,
            id=validated['service_id'],
            provider=provider,
            is_active=True
        )

        slots_data = generate_available_slots(
            provider=provider,
            service=service,
            start_date=validated['from_date'],
            end_date=validated['to_date'],
            customer_tz_str=validated.get('tz')
        )

        return Response(slots_data, status=status.HTTP_200_OK)


class BookingListCreateView(generics.ListCreateAPIView):
    """
    List user's bookings or create a new booking.
    Supports idempotent submission via 'Idempotency-Key' header.
    Rate limited via ScopedRateThrottle ('booking' scope: 10/min).
    """
    permission_classes = [IsAuthenticated]
    serializer_class = BookingDetailSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'booking'

    def get_queryset(self):
        user = self.request.user
        status_param = self.request.query_params.get('status')

        if user.role == 'admin':
            queryset = Booking.objects.all()
        elif user.role == 'provider':
            queryset = Booking.objects.filter(provider__user=user)
        else:
            queryset = Booking.objects.filter(customer=user)

        if status_param:
            queryset = queryset.filter(status=status_param)

        return queryset.select_related('provider', 'service', 'customer')

    def create(self, request, *args, **kwargs):
        # 1. Parse Idempotency Key from headers (or generate UUID)
        raw_key = request.headers.get('Idempotency-Key')
        if raw_key:
            try:
                idempotency_key = uuid.UUID(raw_key)
            except ValueError:
                return Response(
                    {"error": "invalid_idempotency_key", "detail": "Idempotency-Key header must be a valid UUIDv4."},
                    status=status.HTTP_400_BAD_REQUEST
                )
        else:
            idempotency_key = uuid.uuid4()

        # 2. Validate input
        serializer = BookingCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        provider = generics.get_object_or_404(Provider, id=data['provider_id'])
        service = generics.get_object_or_404(Service, id=data['service_id'])

        # 3. Call BookingService
        try:
            booking, created = BookingService.create_booking(
                customer=request.user,
                provider=provider,
                service=service,
                start_at=data['start_at'],
                idempotency_key=idempotency_key,
                intake_notes=data.get('intake_notes', '')
            )
        except DjangoValidationError as e:
            return Response(
                {"detail": e.messages if hasattr(e, 'messages') else str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

        response_serializer = BookingDetailSerializer(booking)
        response_status = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(response_serializer.data, status=response_status)


class BookingDetailView(generics.RetrieveAPIView):
    """
    Retrieve single booking details. Accessible only to the customer or provider.
    """
    permission_classes = [IsAuthenticated, IsBookingParticipant]
    serializer_class = BookingDetailSerializer

    def get_queryset(self):
        user = self.request.user
        if user.role == 'admin':
            return Booking.objects.all()
        if user.role == 'provider':
            return Booking.objects.filter(provider__user=user)
        return Booking.objects.filter(customer=user)


class BookingRescheduleView(APIView):
    """
    Atomically reschedule a booking to a new start time.
    Enforces object-level permission: only the customer, assigned provider, or admin can reschedule.
    """
    permission_classes = [IsAuthenticated, IsBookingParticipant]

    def patch(self, request, pk):
        booking = generics.get_object_or_404(Booking, id=pk)
        self.check_object_permissions(request, booking)

        serializer = BookingRescheduleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_start_at = serializer.validated_data['new_start_at']

        try:
            updated_booking = BookingService.reschedule_booking(
                booking_id=booking.id,
                new_start_at=new_start_at,
                user=request.user
            )
        except DjangoValidationError as e:
            return Response(
                {"detail": e.messages if hasattr(e, 'messages') else str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

        response_serializer = BookingDetailSerializer(updated_booking)
        return Response(response_serializer.data, status=status.HTTP_200_OK)


class BookingCancelView(APIView):
    """
    Cancel an appointment according to the provider's cancellation notice policy.
    Enforces object-level permission: only the customer, assigned provider, or admin can cancel.
    """
    permission_classes = [IsAuthenticated, IsBookingParticipant]

    def post(self, request, pk):
        booking = generics.get_object_or_404(Booking, id=pk)
        self.check_object_permissions(request, booking)

        serializer = BookingCancelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reason = serializer.validated_data.get('reason', '')

        try:
            cancelled_booking, is_late = BookingService.cancel_booking(
                booking_id=booking.id,
                user=request.user,
                reason=reason
            )
            # Smart Cancellation Recovery: Match and notify active waitlist standbys
            try:
                from apps.ai_assistant.services import AIWaitlistService
                AIWaitlistService.match_and_notify_waitlist(cancelled_booking)
            except Exception as waitlist_err:
                import logging
                logging.getLogger(__name__).warning("Waitlist matching error: %s", waitlist_err)
        except DjangoValidationError as e:
            return Response(
                {"detail": e.messages if hasattr(e, 'messages') else str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

        msg = (
            "Booking late cancelled past the free cancellation window."
            if is_late else
            "Booking successfully cancelled within the free cancellation window."
        )

        return Response(
            {
                "id": cancelled_booking.id,
                "status": cancelled_booking.status,
                "is_late": is_late,
                "cancelled_at": cancelled_booking.cancelled_at,
                "message": msg
            },
            status=status.HTTP_200_OK
        )


class BookingAcceptView(APIView):
    """
    Accept an incoming pending booking request by the assigned provider.
    Transitions status from 'pending' to 'confirmed'.
    """
    permission_classes = [IsAuthenticated, IsBookingProvider]

    def post(self, request, pk):
        booking = generics.get_object_or_404(Booking, id=pk)
        self.check_object_permissions(request, booking)

        try:
            confirmed_booking = BookingService.accept_booking(
                booking_id=booking.id,
                provider_user=request.user
            )
        except DjangoValidationError as e:
            return Response(
                {"detail": e.messages if hasattr(e, 'messages') else str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response(
            {
                "id": confirmed_booking.id,
                "status": confirmed_booking.status,
                "message": "Booking accepted and confirmed."
            },
            status=status.HTTP_200_OK
        )


class BookingCompleteView(APIView):
    """
    Mark appointment as completed by the provider.
    Enforces object-level permission: only the assigned provider or admin can complete.
    """
    permission_classes = [IsAuthenticated, IsBookingProvider]

    def post(self, request, pk):
        booking = generics.get_object_or_404(Booking, id=pk)
        self.check_object_permissions(request, booking)

        try:
            completed_booking = BookingService.complete_booking(
                booking_id=booking.id,
                provider_user=request.user
            )
        except DjangoValidationError as e:
            return Response(
                {"detail": e.messages if hasattr(e, 'messages') else str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

        return Response(
            {
                "id": completed_booking.id,
                "status": completed_booking.status,
                "message": "Appointment marked as completed."
            },
            status=status.HTTP_200_OK
        )
