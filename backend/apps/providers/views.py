from django.db import transaction
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsProvider
from apps.providers.models import Provider, Service, TimeOff, WorkingHour
from apps.providers.serializers import (
    ProviderProfileSerializer,
    PublicProviderDetailSerializer,
    PublicProviderListSerializer,
    ServiceSerializer,
    TimeOffSerializer,
    WorkingHourSerializer,
)


class ProviderProfileMeView(generics.RetrieveUpdateAPIView):
    """
    Allows the authenticated provider to view and update their business profile,
    timezone, minimum notice window, and cancellation policy.
    """
    permission_classes = [IsAuthenticated, IsProvider]
    serializer_class = ProviderProfileSerializer

    def get_object(self):
        # Auto-create profile if missing
        profile, _ = Provider.objects.get_or_create(
            user=self.request.user,
            defaults={
                'display_name': f"{self.request.user.first_name} {self.request.user.last_name}".strip() or self.request.user.email.split('@')[0],
                'timezone': self.request.user.timezone or 'UTC'
            }
        )
        return profile


class ProviderServiceListCreateView(generics.ListCreateAPIView):
    """
    List or create services offered by the authenticated provider.
    """
    permission_classes = [IsAuthenticated, IsProvider]
    serializer_class = ServiceSerializer

    def get_queryset(self):
        return Service.objects.filter(provider=self.request.user.provider_profile)

    def perform_create(self, serializer):
        serializer.save(provider=self.request.user.provider_profile)


class ProviderServiceDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Retrieve, update, or deactivate a service owned by the provider.
    """
    permission_classes = [IsAuthenticated, IsProvider]
    serializer_class = ServiceSerializer

    def get_queryset(self):
        return Service.objects.filter(provider=self.request.user.provider_profile)


class ProviderWorkingHoursView(APIView):
    """
    Retrieve or bulk-update the provider's 7-day recurring weekly working hours schedule.
    """
    permission_classes = [IsAuthenticated, IsProvider]

    def get(self, request):
        provider = request.user.provider_profile
        hours = provider.working_hours.all()
        serializer = WorkingHourSerializer(hours, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def _save_working_hours(self, request):
        provider = request.user.provider_profile
        data = request.data
        if isinstance(data, dict) and 'working_hours' in data:
            data = data['working_hours']

        if not isinstance(data, list):
            return Response(
                {"detail": "Expected a list of working hour items or a dict with 'working_hours'."},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = WorkingHourSerializer(data=data, many=True)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            # Atomically replace working hours
            provider.working_hours.all().delete()
            created_instances = [
                WorkingHour(provider=provider, **item)
                for item in serializer.validated_data
            ]
            WorkingHour.objects.bulk_create(created_instances)

        response_serializer = WorkingHourSerializer(
            provider.working_hours.all(),
            many=True
        )
        return Response(response_serializer.data, status=status.HTTP_200_OK)

    def put(self, request):
        return self._save_working_hours(request)

    def post(self, request):
        return self._save_working_hours(request)


class ProviderTimeOffListCreateView(generics.ListCreateAPIView):
    """
    List and schedule vacation or blackout dates for the provider.
    """
    permission_classes = [IsAuthenticated, IsProvider]
    serializer_class = TimeOffSerializer

    def get_queryset(self):
        return TimeOff.objects.filter(provider=self.request.user.provider_profile)

    def perform_create(self, serializer):
        serializer.save(provider=self.request.user.provider_profile)


class ProviderTimeOffDetailView(generics.DestroyAPIView):
    """
    Remove a previously blocked blackout/time-off date range.
    """
    permission_classes = [IsAuthenticated, IsProvider]
    serializer_class = TimeOffSerializer

    def get_queryset(self):
        return TimeOff.objects.filter(provider=self.request.user.provider_profile)


class PublicProviderListView(generics.ListAPIView):
    """
    Public directory for customers to search and view available service providers.
    """
    permission_classes = [AllowAny]
    serializer_class = PublicProviderListSerializer

    def get_queryset(self):
        queryset = Provider.objects.all()
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(display_name__icontains=search)
        return queryset


class PublicProviderDetailView(generics.RetrieveAPIView):
    """
    Public landing page for a provider showing their active services and availability.
    """
    permission_classes = [AllowAny]
    serializer_class = PublicProviderDetailSerializer
    queryset = Provider.objects.all()
