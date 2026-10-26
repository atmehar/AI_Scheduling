from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

urlpatterns = [
    # Admin Interface
    path('admin/', admin.site.urls),

    # Core System & Health Endpoints
    path('api/', include('apps.core.urls')),

    # Authentication & User Identity
    path('api/auth/', include('apps.accounts.urls')),

    # Provider Profiles, Services & Availability
    path('api/providers/', include('apps.providers.urls')),

    # Dynamic Scheduling & Bookings Engine
    path('api/', include('apps.scheduling.urls')),
    path('api/scheduling/', include('apps.scheduling.urls')),

    # Reminders & Notifications
    path('api/', include('apps.notifications.urls')),

    # AI Scheduling Intelligence Layer
    path('api/ai/', include('apps.ai_assistant.urls')),

    # OpenAPI Schema & Interactive Swagger UI
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
]
