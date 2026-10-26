from django.urls import path
from apps.notifications.views import BookingRemindersListView, UserNotificationFeedView

urlpatterns = [
    path('notifications/', UserNotificationFeedView.as_view(), name='user-notifications-feed'),
    path('bookings/<int:booking_id>/reminders/', BookingRemindersListView.as_view(), name='booking-reminders-list'),
]

