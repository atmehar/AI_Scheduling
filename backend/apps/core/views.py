from django.db import connection
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthCheckView(APIView):
    """
    Endpoint verifying application uptime and live PostgreSQL connectivity.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        db_status = "healthy"
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1;")
                cursor.fetchone()
        except Exception as e:
            db_status = f"unhealthy: {str(e)}"
            return Response(
                {
                    "status": "degraded",
                    "database": db_status,
                    "timestamp": timezone.now().isoformat(),
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        return Response(
            {
                "status": "healthy",
                "database": "connected",
                "timestamp": timezone.now().isoformat(),
            },
            status=status.HTTP_200_OK
        )
