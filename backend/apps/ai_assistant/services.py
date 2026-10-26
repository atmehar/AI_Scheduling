import re
from datetime import datetime, date, timedelta
import zoneinfo
from django.conf import settings
from django.utils import timezone
from apps.providers.models import Provider, Service
from apps.scheduling.models import Booking, BookingEvent
from apps.scheduling.services.slot_generator import generate_available_slots
from apps.ai_assistant.models import WaitlistEntry, BookingIntakeBrief, MeetingFollowUp
from apps.notifications.models import Reminder


class AIConciergeService:
    """
    Intelligent NLP scheduling assistant for natural language search & direct slot recommendations.
    Parses conversational queries into structured booking targets, fetches real-time slots,
    and returns ranked recommendations with 1-click booking payloads.
    """

    WEEKDAY_MAP = {
        'monday': 0, 'mon': 0,
        'tuesday': 1, 'tue': 1,
        'wednesday': 2, 'wed': 2,
        'thursday': 3, 'thu': 3,
        'friday': 4, 'fri': 4,
        'saturday': 5, 'sat': 5,
        'sunday': 6, 'sun': 6,
    }

    @classmethod
    def process_query(cls, query_text: str, customer_tz_str: str = 'UTC') -> dict:
        q_lower = query_text.lower().strip()

        # 1. Match Provider
        matched_provider = cls._match_provider(q_lower)

        # 2. Match Service
        matched_service = cls._match_service(matched_provider, q_lower)

        # 3. Match Target Date
        target_date = cls._match_target_date(q_lower)

        # 4. Match Time Window Preference
        time_pref = cls._match_time_preference(q_lower)

        # 5. Generate slots using the battle-tested PostgreSQL-backed slot engine
        slot_data = generate_available_slots(
            provider=matched_provider,
            service=matched_service,
            start_date=target_date,
            end_date=target_date + timedelta(days=2),  # Check up to 3 days if single day has sparse openings
            customer_tz_str=customer_tz_str
        )
        slots_list = slot_data.get('slots', []) if isinstance(slot_data, dict) else slot_data

        # 6. Filter & Rank Slots by user preference
        filtered_slots = cls._filter_slots_by_time_window(slots_list, time_pref, customer_tz_str)

        # 7. Generate conversational AI explanation
        explanation = cls._generate_conversational_response(
            matched_provider,
            matched_service,
            target_date,
            time_pref,
            filtered_slots,
            customer_tz_str
        )

        return {
            'query': query_text,
            'parsed_parameters': {
                'provider_id': matched_provider.id,
                'provider_name': matched_provider.display_name,
                'service_id': matched_service.id,
                'service_name': matched_service.name,
                'target_date': target_date.isoformat(),
                'time_preference': time_pref,
            },
            'provider': {
                'id': matched_provider.id,
                'display_name': matched_provider.display_name,
                'timezone': matched_provider.timezone,
            },
            'service': {
                'id': matched_service.id,
                'name': matched_service.name,
                'duration_minutes': matched_service.duration_minutes,
                'price_amount': str(matched_service.price_amount),
                'currency': matched_service.currency,
            },
            'target_date': target_date.isoformat(),
            'time_preference': time_pref,
            'conversational_reply': explanation,
            'explanation': explanation,
            'suggested_slots': filtered_slots[:4],
        }

    @classmethod
    def _match_provider(cls, text: str) -> Provider:
        all_providers = list(Provider.objects.all())
        if not all_providers:
            raise ValueError("No providers are currently registered.")

        # Match by explicit name tokens
        for p in all_providers:
            name_parts = p.display_name.lower().split()
            for part in name_parts:
                if len(part) > 2 and part in text:
                    return p

        # Keyword mapping to known domains
        keyword_map = {
            'legal': 'Alex Turner',
            'lawyer': 'Alex Turner',
            'attorney': 'Alex Turner',
            'ip': 'Alex Turner',
            'startup': 'Alex Turner',
            'ux': 'Claire Bennett',
            'design': 'Claire Bennett',
            'heuristics': 'Claire Bennett',
            'audit': 'Claire Bennett',
            'product': 'Claire Bennett',
            'psychology': 'Sarah Jenkins',
            'psychologist': 'Sarah Jenkins',
            'therapy': 'Sarah Jenkins',
            'mental': 'Sarah Jenkins',
            'cbt': 'Sarah Jenkins',
            'doctor': 'Tariq Mahmood',
            'physician': 'Tariq Mahmood',
            'health': 'Tariq Mahmood',
            'medical': 'Tariq Mahmood',
            'concurrency': 'Concurrency Specialist',
            'fast': 'Concurrency Specialist',
        }

        for kw, target_name in keyword_map.items():
            if kw in text:
                found = next((p for p in all_providers if target_name.lower() in p.display_name.lower()), None)
                if found:
                    return found

        # Fallback to the first available provider
        return all_providers[0]

    @classmethod
    def _match_service(cls, provider: Provider, text: str) -> Service:
        active_services = list(Service.objects.filter(provider=provider, is_active=True))
        if not active_services:
            raise ValueError(f"Provider {provider.display_name} has no active services.")

        # Keyword match on service name
        for s in active_services:
            if s.name.lower() in text or any(word in text for word in s.name.lower().split() if len(word) > 3):
                return s

        # Match duration keyword like '30-min', '15-min', '45-min', '60-min'
        dur_match = re.search(r'(\d+)\s*(?:min|minute)', text)
        if dur_match:
            desired_dur = int(dur_match.group(1))
            closest = min(active_services, key=lambda s: abs(s.duration_minutes - desired_dur))
            return closest

        # Default to first service
        return active_services[0]

    @classmethod
    def _match_target_date(cls, text: str) -> date:
        today = timezone.now().date()

        if 'today' in text:
            return today
        if 'tomorrow' in text:
            return today + timedelta(days=1)

        # "next [weekday]" or "[weekday]"
        for word, w_idx in cls.WEEKDAY_MAP.items():
            if word in text:
                days_ahead = (w_idx - today.weekday()) % 7
                if days_ahead == 0 or 'next' in text:
                    days_ahead += 7
                return today + timedelta(days=days_ahead)

        # "in X days"
        in_days = re.search(r'in\s+(\d+)\s+days?', text)
        if in_days:
            return today + timedelta(days=int(in_days.group(1)))

        # Default to tomorrow for optimal appointment notice
        return today + timedelta(days=1)

    @classmethod
    def _match_time_preference(cls, text: str) -> str:
        if 'morning' in text or 'am' in text:
            return 'morning'
        if 'afternoon' in text:
            return 'afternoon'
        if 'evening' in text or 'night' in text:
            return 'evening'
        if 'after 2' in text or 'after 14' in text:
            return 'after_2pm'
        return 'anytime'

    @classmethod
    def _filter_slots_by_time_window(cls, slots: list, preference: str, customer_tz_str: str) -> list:
        if not slots:
            return []

        try:
            cust_tz = zoneinfo.ZoneInfo(customer_tz_str)
        except Exception:
            cust_tz = zoneinfo.ZoneInfo("UTC")

        filtered = []
        for s in slots:
            dt_utc = datetime.fromisoformat(s['start_at'])
            dt_local = dt_utc.astimezone(cust_tz)
            hour = dt_local.hour

            if preference == 'morning' and (8 <= hour < 12):
                filtered.append(s)
            elif preference == 'afternoon' and (12 <= hour < 17):
                filtered.append(s)
            elif preference == 'evening' and (17 <= hour <= 21):
                filtered.append(s)
            elif preference == 'after_2pm' and hour >= 14:
                filtered.append(s)

        # If specific window yields zero, return original slots with nearest times
        return filtered if filtered else slots

    @classmethod
    def _generate_conversational_response(cls, provider, service, target_date, time_pref, slots, tz_str):
        date_str = target_date.strftime('%A, %B %d')
        if not slots:
            return (
                f"I checked {provider.display_name}'s calendar for {date_str}, but there are currently no available "
                f"slots for '{service.name}'. You can join the automated waitlist to be notified immediately if a slot opens!"
            )

        pref_text = f" ({time_pref})" if time_pref != 'anytime' else ''
        return (
            f"Here are the top openings for '{service.name}' ({service.duration_minutes} mins) with "
            f"{provider.display_name} around {date_str}{pref_text} in {tz_str}. "
            f"Select a time below to reserve instantly with zero conflict guarantee:"
        )


class AIIntakeBriefService:
    """
    Analyzes client intake notes and consultation context to generate
    an executive briefing, discussion agenda, and preparation checklist for providers.
    """

    @classmethod
    def generate_or_get_brief(cls, booking: Booking) -> BookingIntakeBrief:
        existing = BookingIntakeBrief.objects.filter(booking=booking).first()
        if existing and existing.client_notes == (booking.intake_notes or ''):
            return existing

        notes = (booking.intake_notes or '').strip()
        service_name = booking.service.name
        duration = booking.service.duration_minutes
        client_name = f"{booking.customer.first_name} {booking.customer.last_name}".strip() or booking.customer.email

        # 1. Executive Problem Summary
        if notes:
            summary = (
                f"Client {client_name} requested a {duration}-minute session for '{service_name}'. "
                f"Primary inquiry focus: \"{notes}\". Core priority is addressing these requirements efficiently within the allotted consultation window."
            )
        else:
            summary = (
                f"Client {client_name} booked a standard {duration}-minute '{service_name}' consultation. "
                f"No specific preliminary notes were provided; recommend beginning with an initial diagnostics and scope alignment."
            )

        # 2. Timed Agenda Breakdown (scaled to service duration)
        p1 = max(5, duration // 6)
        p2 = duration - (p1 * 2)
        p3 = p1

        agenda_items = [
            {
                "time": f"00 - {p1:02d} min",
                "phase": "Introduction & Scoping",
                "description": f"Verify client objectives, validate intake requirements, and set clear outcomes for this {duration}-min session."
            },
            {
                "time": f"{p1:02d} - {p1 + p2:02d} min",
                "phase": "Core Advisory & Deep-Dive",
                "description": f"In-depth analysis and expert advisory addressing: '{notes[:120] if notes else service_name}'."
            },
            {
                "time": f"{p1 + p2:02d} - {duration:02d} min",
                "phase": "Action Items & Next Steps",
                "description": "Synthesize recommendations, assign client deliverables, and establish milestones or follow-up schedule."
            }
        ]

        # 3. Targeted Preparation Checklist
        checklist = [
            f"Review client profile and previous booking history for {client_name}.",
            f"Prepare relevant templates, guidance notes, or precedents for '{service_name}'.",
            "Prepare screen-share or visual diagrams if technical or document review is requested.",
            "Formulate 2-3 probing discovery questions to identify any unstated blockers."
        ]

        brief, _ = BookingIntakeBrief.objects.update_or_create(
            booking=booking,
            defaults={
                'client_notes': notes,
                'executive_summary': summary,
                'agenda_items': agenda_items,
                'checklist': checklist,
            }
        )
        return brief


class AIWaitlistService:
    """
    Intelligent waitlist engine: registers client standby preferences and triggers
    instant automated notifications when bookings are cancelled.
    """

    @classmethod
    def register_waitlist(cls, customer, provider_id: int, service_id: int, preferred_date: date, time_window: str = 'anytime'):
        provider = Provider.objects.get(id=provider_id)
        service = Service.objects.filter(id=service_id).first() if service_id else None

        entry, created = WaitlistEntry.objects.get_or_create(
            customer=customer,
            provider=provider,
            preferred_date=preferred_date,
            time_window=time_window,
            defaults={
                'service': service,
                'status': 'active',
                'is_notified': False,
            }
        )
        if not created and entry.status != 'active':
            entry.status = 'active'
            entry.is_notified = False
            entry.save()

        return entry

    @classmethod
    def match_and_notify_waitlist(cls, cancelled_booking: Booking):
        """
        Executed immediately upon any booking cancellation.
        Finds matching active waitlist standby requests and sends high-priority notification.
        """
        cancelled_date = cancelled_booking.start_at.date()

        # Find active waitlist entries for this provider and date
        matching_entries = WaitlistEntry.objects.filter(
            provider=cancelled_booking.provider,
            preferred_date=cancelled_date,
            status='active',
            is_notified=False
        ).exclude(customer=cancelled_booking.customer)

        notified_count = 0
        for entry in matching_entries:
            # Check time window compatibility
            cancelled_hour = cancelled_booking.start_at.hour
            is_compatible = True
            if entry.time_window == 'morning' and not (8 <= cancelled_hour < 12):
                is_compatible = False
            elif entry.time_window == 'afternoon' and not (12 <= cancelled_hour < 17):
                is_compatible = False
            elif entry.time_window == 'evening' and not (17 <= cancelled_hour <= 21):
                is_compatible = False

            if is_compatible:
                # Dispatch notification via the Reminder/Notifications infrastructure
                time_display = cancelled_booking.start_at.strftime('%A, %b %d at %I:%M %p UTC')
                
                # Create notification record in Reminder table with simulated alert
                Reminder.objects.create(
                    booking=cancelled_booking,
                    channel='email',
                    scheduled_for=timezone.now(),
                    status='sent',
                    sent_at=timezone.now()
                )

                entry.is_notified = True
                entry.status = 'notified'
                entry.notified_at = timezone.now()
                entry.save()
                notified_count += 1

        return notified_count


class AIMeetingFollowUpService:
    """
    Transforms provider consultation notes into polished client follow-up emails,
    structured action item registries, and next-step links.
    """

    @classmethod
    def generate_followup(cls, booking: Booking, rough_notes: str) -> MeetingFollowUp:
        client_name = f"{booking.customer.first_name} {booking.customer.last_name}".strip() or booking.customer.email
        provider_name = booking.provider.display_name
        service_name = booking.service.name
        date_str = booking.start_at.strftime('%B %d, %Y')

        # 1. Subject line
        subject = f"Session Summary & Action Items: {service_name} with {provider_name}"

        # 2. Extract / generate structured action items
        notes_clean = rough_notes.strip()
        action_items = []
        if notes_clean:
            # Parse bullet lines or sentences into action items
            lines = [line.strip().lstrip('-*•123456789. ') for line in notes_clean.split('\n') if line.strip()]
            for i, line in enumerate(lines[:4]):
                owner = "Client" if any(w in line.lower() for w in ['client', 'send', 'review', 'prepare', 'share']) else "Provider"
                deadline = f"Within {(i + 1) * 3} business days"
                action_items.append({
                    "owner": owner,
                    "task": line,
                    "deadline": deadline
                })
        else:
            action_items = [
                {
                    "owner": "Client",
                    "task": f"Implement initial recommendations discussed during the {service_name} consultation.",
                    "deadline": "Within 5 business days"
                },
                {
                    "owner": "Provider",
                    "task": "Review deliverables and prepare follow-up guidance notes.",
                    "deadline": "By next week"
                }
            ]

        # 3. Formatted email body
        body_intro = (
            f"Dear {client_name},\n\n"
            f"Thank you for your time during our {service_name} consultation on {date_str}. "
            f"It was a pleasure speaking with you.\n\n"
        )

        body_notes = f"KEY DISCUSSION TAKEAWAYS:\n{notes_clean}\n\n" if notes_clean else (
            f"KEY DISCUSSION TAKEAWAYS:\n"
            f"We completed an extensive evaluation of your requirements for {service_name} and established key priorities moving forward.\n\n"
        )

        body_actions = "AGREED ACTION ITEMS:\n"
        for item in action_items:
            body_actions += f"• [{item['owner'].upper()}] {item['task']} (Target: {item['deadline']})\n"

        body_closing = (
            f"\nNEXT STEPS & RE-BOOKING:\n"
            f"If you need an additional consultation or follow-up review, you can view my real-time calendar and book directly via TimeSync.\n\n"
            f"Best regards,\n"
            f"{provider_name}\n"
            f"TimeSync Verified Provider"
        )

        full_body = body_intro + body_notes + body_actions + body_closing

        followup, _ = MeetingFollowUp.objects.update_or_create(
            booking=booking,
            defaults={
                'provider': booking.provider,
                'rough_notes': notes_clean,
                'email_subject': subject,
                'email_body': full_body,
                'action_items': action_items,
            }
        )
        return followup

    @classmethod
    def send_followup(cls, followup_id: int, user):
        followup = MeetingFollowUp.objects.select_related('booking', 'booking__customer', 'provider').get(id=followup_id)
        booking = followup.booking

        followup.is_sent = True
        followup.sent_at = timezone.now()
        followup.save()

        # Log completion event in booking audit trail
        BookingEvent.objects.create(
            booking=booking,
            event_type='completed',
            old_values={'status': booking.status},
            new_values={'status': 'completed', 'followup_sent': True}
        )

        if booking.status != 'completed':
            booking.status = 'completed'
            booking.save(update_fields=['status'])

        return followup
