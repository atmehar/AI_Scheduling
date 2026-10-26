from django.urls import path
from apps.providers.views import (
    ProviderProfileMeView,
    ProviderServiceDetailView,
    ProviderServiceListCreateView,
    ProviderTimeOffDetailView,
    ProviderTimeOffListCreateView,
    ProviderWorkingHoursView,
    PublicProviderDetailView,
    PublicProviderListView,
)

urlpatterns = [
    # Provider Dashboard Management Routes (Authenticated Provider)
    path('me/', ProviderProfileMeView.as_view(), name='provider-me'),
    path('me/services/', ProviderServiceListCreateView.as_view(), name='provider-services-list-create'),
    path('me/services/<int:pk>/', ProviderServiceDetailView.as_view(), name='provider-services-detail'),
    path('me/working-hours/', ProviderWorkingHoursView.as_view(), name='provider-working-hours'),
    path('me/time-off/', ProviderTimeOffListCreateView.as_view(), name='provider-time-off-list-create'),
    path('me/time-off/<int:pk>/', ProviderTimeOffDetailView.as_view(), name='provider-time-off-detail'),

    # Public Discovery Routes (Public / Customer)
    path('', PublicProviderListView.as_view(), name='public-provider-list'),
    path('<int:pk>/', PublicProviderDetailView.as_view(), name='public-provider-detail'),
]
