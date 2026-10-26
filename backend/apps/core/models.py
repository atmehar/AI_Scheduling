from django.db import models


class TimeStampedModel(models.Model):
    """
    Abstract base model providing self-updating
    created_at and updated_at timestamp fields in UTC.
    """
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
