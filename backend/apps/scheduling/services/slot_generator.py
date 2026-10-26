from datetime import datetime, timedelta
import zoneinfo
from django.utils import timezone
from apps.scheduling.models import Booking


def generate_available_slots(provider, service, start_date, end_date, customer_tz_str=None):
    """
    Dynamically computes available, conflict-free appointment slots for a given provider
    and service across a specified date range.

    Guarantees:
    - DST-safe: Converts provider local working hours to UTC using IANA timezone.
    - Buffer-aware: Respects turnaround buffer between consecutive appointments.
    - Notice-aware: Discards slots starting before (now + provider.min_notice_minutes).
    - Conflict-free: Excludes slots overlapping with active bookings or blackout time-offs.
    - Localized: Returns timestamps in UTC, plus user-friendly display times in customer timezone.
    """
    # 1. Resolve timezones
    try:
        provider_tz = zoneinfo.ZoneInfo(provider.timezone)
    except Exception:
        provider_tz = zoneinfo.ZoneInfo("UTC")

    target_customer_tz_str = customer_tz_str or provider.timezone
    try:
        customer_tz = zoneinfo.ZoneInfo(target_customer_tz_str)
    except Exception:
        customer_tz = provider_tz
        target_customer_tz_str = provider.timezone

    # 2. Setup bounds and cutoffs
    now_utc = timezone.now()
    min_notice_cutoff = now_utc + timedelta(minutes=provider.min_notice_minutes)
    duration_delta = timedelta(minutes=service.duration_minutes)
    step_delta = timedelta(minutes=service.duration_minutes + service.buffer_minutes)

    # 3. Query existing active bookings and time-off blocks covering the date range
    window_start_utc = datetime.combine(start_date, datetime.min.time(), tzinfo=provider_tz).astimezone(zoneinfo.ZoneInfo("UTC"))
    window_end_utc = datetime.combine(end_date, datetime.max.time(), tzinfo=provider_tz).astimezone(zoneinfo.ZoneInfo("UTC"))

    active_bookings = list(
        Booking.objects.filter(
            provider=provider,
            status__in=['pending', 'confirmed'],
            end_at__gte=window_start_utc,
            start_at__lte=window_end_utc
        ).only('start_at', 'end_at')
    )

    time_off_blocks = list(
        provider.time_off_blocks.filter(
            end_at__gte=window_start_utc,
            start_at__lte=window_end_utc
        ).only('start_at', 'end_at')
    )

    working_hours = list(provider.working_hours.all())

    available_slots = []
    current_date = start_date

    # 4. Iterate day-by-day through search window
    while current_date <= end_date:
        weekday = current_date.weekday()  # 0 = Monday, 6 = Sunday
        daily_schedules = [wh for wh in working_hours if wh.weekday == weekday]

        for schedule in daily_schedules:
            # Construct timezone-aware local start and end
            local_start = datetime.combine(current_date, schedule.start_time, tzinfo=provider_tz)
            local_end = datetime.combine(current_date, schedule.end_time, tzinfo=provider_tz)

            # Convert to UTC instants
            utc_cursor = local_start.astimezone(zoneinfo.ZoneInfo("UTC"))
            utc_schedule_end = local_end.astimezone(zoneinfo.ZoneInfo("UTC"))

            while utc_cursor + duration_delta <= utc_schedule_end:
                slot_start = utc_cursor
                slot_end = slot_start + duration_delta
                buffer_end = slot_start + step_delta

                # Filter 1: Notice cutoff (slot must start after now + min_notice_minutes)
                if slot_start < min_notice_cutoff:
                    utc_cursor = buffer_end
                    continue

                # Filter 2: Active booking overlaps
                # Two intervals [A_start, A_end) and [B_start, B_end) overlap iff:
                # max(A_start, B_start) < min(A_end, B_end)
                has_booking_conflict = any(
                    max(slot_start, b.start_at) < min(slot_end, b.end_at)
                    for b in active_bookings
                )

                # Filter 3: Time-off blackout overlaps
                has_timeoff_conflict = any(
                    max(slot_start, t.start_at) < min(slot_end, t.end_at)
                    for t in time_off_blocks
                )

                if not has_booking_conflict and not has_timeoff_conflict:
                    # Convert to customer timezone for human presentation
                    display_start = slot_start.astimezone(customer_tz)
                    display_end = slot_end.astimezone(customer_tz)

                    available_slots.append({
                        "start_at": slot_start.isoformat(),
                        "end_at": slot_end.isoformat(),
                        "display_start": display_start.strftime("%Y-%m-%d %H:%M"),
                        "display_end": display_end.strftime("%H:%M"),
                        "display_date": display_start.strftime("%Y-%m-%d"),
                        "display_time": f"{display_start.strftime('%I:%M %p')} - {display_end.strftime('%I:%M %p')}"
                    })

                utc_cursor = buffer_end

        current_date += timedelta(days=1)

    return {
        "provider_id": provider.id,
        "service_id": service.id,
        "timezone": target_customer_tz_str,
        "total_slots": len(available_slots),
        "slots": available_slots
    }
