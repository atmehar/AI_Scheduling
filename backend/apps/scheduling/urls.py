from django.urls import path
from apps.scheduling.views import (
    BookingAcceptView,
    BookingCancelView,
    BookingCompleteView,
    BookingDetailView,
    BookingListCreateView,
    BookingRescheduleView,
    ProviderSlotsView,
)

urlpatterns = [
    # Dynamic Slot Calculation Engine
    path('providers/<int:provider_id>/slots/', ProviderSlotsView.as_view(), name='provider-slots'),

    # Booking Lifecycle Endpoints
    path('bookings/', BookingListCreateView.as_view(), name='booking-list-create'),
    path('bookings/<int:pk>/', BookingDetailView.as_view(), name='booking-detail'),
    path('bookings/<int:pk>/accept/', BookingAcceptView.as_view(), name='booking-accept'),
    path('bookings/<int:pk>/reschedule/', BookingRescheduleView.as_view(), name='booking-reschedule'),
    path('bookings/<int:pk>/cancel/', BookingCancelView.as_view(), name='booking-cancel'),
    path('bookings/<int:pk>/complete/', BookingCompleteView.as_view(), name='booking-complete'),
]
