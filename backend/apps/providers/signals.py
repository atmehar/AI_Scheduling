from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.providers.models import Provider


@receiver(post_save, sender=settings.AUTH_USER_MODEL)
def create_provider_profile_on_user_creation(sender, instance, created, **kwargs):
    """
    Automatically creates a Provider profile stub when a user with
    role 'provider' is created.
    """
    if created and instance.role == 'provider':
        display_name = f"{instance.first_name} {instance.last_name}".strip() or instance.email.split('@')[0]
        Provider.objects.get_or_create(
            user=instance,
            defaults={
                'display_name': display_name,
                'timezone': instance.timezone or 'UTC'
            }
        )
