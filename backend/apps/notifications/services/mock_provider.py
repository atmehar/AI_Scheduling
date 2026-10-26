import logging
from django.utils import timezone

logger = logging.getLogger('notifications.mock')


class MockNotificationProvider:
    """
    [MOCKED NOTIFICATION PROVIDER - SIMULATED EMAIL & SMS GATEWAY]
    Simulates production notification vendors (e.g. Twilio for SMS, SendGrid / AWS SES for Email).
    Outputs structured delivery logs to stdout and the application logger.
    """

    @classmethod
    def send_notification(cls, reminder, simulate_failure=False):
        """
        Simulates dispatching an email or SMS notification for an appointment.
        """
        if simulate_failure:
            raise RuntimeError(
                f"[MOCK NOTIFICATION FAILURE] Simulated network drop while dispatching to {reminder.booking.customer.email}"
            )

        booking = reminder.booking
        customer = booking.customer
        provider = booking.provider
        service = booking.service

        formatted_time = booking.start_at.strftime('%A, %B %d, %Y at %I:%M %p UTC')

        subject = f"Appointment Reminder: {service.name} with {provider.display_name}"
        body = (
            f"Hello {customer.first_name or customer.email},\n\n"
            f"This is a reminder for your upcoming appointment:\n"
            f"- Service: {service.name} ({service.duration_minutes} minutes)\n"
            f"- Provider: {provider.display_name}\n"
            f"- Scheduled Time: {formatted_time}\n"
            f"- Cancellation Policy: Free cancellation until {provider.cancellation_hours} hours prior.\n\n"
            f"Thank you for choosing {provider.display_name}!"
        )

        dispatch_log = (
            f"\n==================== [MOCK NOTIFICATION DISPATCH] ====================\n"
            f"CHANNEL:       {reminder.channel.upper()}\n"
            f"RECIPIENT:     {customer.email}\n"
            f"SUBJECT:       {subject}\n"
            f"DISPATCH TIME: {timezone.now().isoformat()}\n"
            f"BODY:\n{body}\n"
            f"======================================================================\n"
        )

        logger.info(dispatch_log)
        # Also print to stdout so it shows up in worker terminal runs
        print(dispatch_log)

        return {
            "status": "delivered",
            "channel": reminder.channel,
            "recipient": customer.email,
            "timestamp": timezone.now().isoformat()
        }
