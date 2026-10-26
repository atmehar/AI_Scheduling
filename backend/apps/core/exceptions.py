import logging
from django.db import IntegrityError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    """
    Custom DRF exception handler that intercepts database IntegrityError
    caused by PostgreSQL ExclusionConstraint violations (double-booking conflicts)
    and maps them to a structured HTTP 409 Conflict response.
    """
    response = exception_handler(exc, context)

    # If DRF standard handler didn't handle it, inspect if it's an IntegrityError
    if response is None:
        if isinstance(exc, IntegrityError):
            err_msg = str(exc)
            logger.warning("Database IntegrityError intercepted: %s", err_msg)

            # Check if this is an exclusion constraint collision on bookings
            if "no_overlap" in err_msg or "exclusion" in err_msg.lower() or "violates exclusion constraint" in err_msg.lower():
                return Response(
                    {
                        "error": "slot_conflict",
                        "detail": "This appointment slot has already been booked by another user. Please select an alternate slot."
                    },
                    status=status.HTTP_409_CONFLICT
                )

            # Generic integrity error fallback
            return Response(
                {
                    "error": "database_integrity_error",
                    "detail": "A database conflict or constraint violation occurred."
                },
                status=status.HTTP_409_CONFLICT
            )

    return response
