from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from apps.accounts.views import (
    CustomTokenObtainPairView,
    UserProfileView,
    UserRegistrationView,
)

urlpatterns = [
    path('register/', UserRegistrationView.as_view(), name='auth-register'),
    path('token/', CustomTokenObtainPairView.as_view(), name='token-obtain-pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token-refresh'),
    path('me/', UserProfileView.as_view(), name='user-profile'),
]
