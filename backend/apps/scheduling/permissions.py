from rest_framework.permissions import BasePermission


class IsBookingParticipant(BasePermission):
    """
    Object-level permission ensuring that only the customer who placed the booking,
    the assigned provider's user, or an administrator can access/modify the booking.
    """
    message = "You do not have permission to access or modify another user's booking."

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.role == 'admin':
            return True
        return obj.customer_id == request.user.id or obj.provider.user_id == request.user.id


class IsBookingProvider(BasePermission):
    """
    Object-level permission ensuring that only the assigned provider
    (or an administrator) can complete or manage the appointment.
    """
    message = "Only the assigned provider can complete this appointment."

    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.role == 'admin':
            return True
        return obj.provider.user_id == request.user.id
