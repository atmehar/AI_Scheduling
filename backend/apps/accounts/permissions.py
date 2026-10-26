from rest_framework.permissions import BasePermission


class IsCustomer(BasePermission):
    """
    Allows access only to authenticated users with the 'customer' role.
    """
    message = "Only customers are permitted to perform this action."

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role == 'customer'
        )


class IsProvider(BasePermission):
    """
    Allows access only to authenticated users with the 'provider' role.
    """
    message = "Only service providers are permitted to perform this action."

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role == 'provider'
        )


class IsAdminRole(BasePermission):
    """
    Allows access only to users with the 'admin' role or staff status.
    """
    message = "Only platform administrators are permitted to perform this action."

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            (request.user.role == 'admin' or request.user.is_staff)
        )
