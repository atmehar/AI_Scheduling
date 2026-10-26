# Appointment & Scheduling SaaS — Project Documentation

> Status tags: **[IMPLEMENTED]**, **[MOCKED]**, **[PROPOSED]**. Keep them honest.

## 1. Purpose and Product Summary

Small service businesses (clinics, salons, tutors, consultants) lose time and money to phone-based booking, double bookings and no-shows. This product lets **providers** publish services and working hours, and lets **customers** book, reschedule and cancel online, with reminders and guaranteed **no overlapping bookings**.

**Out of scope (MVP):** real payments, calendar sync (Google/Outlook), video calls, multi-branch chains, waitlists, SMS gateway integration (mock only), recurring appointments.

## 2. Users and Roles

| Role | Goals | Permissions |
|---|---|---|
| Customer | Find a service, pick a slot, manage own bookings | Create/reschedule/cancel own bookings |
| Provider | Define services and hours, see schedule | Manage own profile, services, availability, view own bookings, cancel/complete |
| Admin (optional) | Support/oversight | Read all, manage users |

## 3. Project Stack & Architecture

| Layer | Choice | Why |
|---|---|---|
| Backend | **Django + Django REST Framework (DRF)** (Python) | Enterprise-grade web framework with battle-tested ORM, built-in migration management, custom authentication, DRF serializers, and OpenAPI generation via `drf-spectacular` |
| Database | **PostgreSQL** | Native support for `btree_gist` and `EXCLUDE USING gist` constraints (`ExclusionConstraint` in Django PostgreSQL module) — the strongest database-level defense against double booking |
| Frontend | **Next.js (React Framework)** | Production-ready React framework with App Router, server/client components, optimized SSR/CSR, seamless integration with DRF APIs, responsive UI for customer booking & provider management |
| Jobs | PostgreSQL `reminders` table + Django Management Command Worker (`SKIP LOCKED`) | Reminder scheduling, exponential retries, and failure recovery without requiring external Redis/Celery infrastructure in MVP |
| Auth | **JWT (Django REST Framework SimpleJWT)** + Django Password Hashing | Stateless JWT authentication (`access` and `refresh` tokens), secure password hashing (PBKDF2/Argon2), role-based permissions (`IsCustomer`, `IsProvider`, `IsAdminUser`) |
| Reminders | **[MOCKED]** provider writing to log/DB; production: email (SES/SendGrid) / SMS gateway (Twilio) | Easily swappable via backend notification service adapter pattern |
| Time | Store **UTC** in DB (`DateTimeField` with `USE_TZ = True`); provider has an IANA time zone (e.g. `Asia/Karachi`) | Handled via Python standard library `zoneinfo`, DST-safe |

## 4. Core Design Decisions

### 4.1 Preventing double bookings (most important)
Use a **database-level guarantee**, not only application checks:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE bookings ADD CONSTRAINT no_overlap
  EXCLUDE USING gist (
    provider_id WITH =,
    tstzrange(start_at, end_at, '[)') WITH &&
  ) WHERE (status IN ('pending','confirmed'));
```

**Django ORM Integration:**
- PostgreSQL `btree_gist` extension enabled via Django migration `BtreeGistExtension()` from `django.contrib.postgres.operations`.
- Constraint defined in Django models using `django.contrib.postgres.constraints.ExclusionConstraint` or raw SQL migration `migrations.RunSQL`.
- Two concurrent requests for the same slot: one succeeds, the other triggers an `IntegrityError` at the database level.
- A custom DRF exception handler catches the exclusion constraint `IntegrityError` and returns an HTTP **409 Conflict** response (`{"error": "slot_conflict", "detail": "This slot has already been booked by another user."}`).
- Half-open range `[start, end)` allows back-to-back bookings (10:00–10:30 and 10:30–11:00).
- Cancelled bookings are excluded by the `WHERE` condition, immediately making the slot available again.
- Rescheduling is executed inside a Django `transaction.atomic()` block (updating times; constraint re-checked atomically; rolls back if conflict occurs).

Alternative considered: `SELECT ... FOR UPDATE` locking or Redis locks — more fragile and not a data-level guarantee. Kept as explanation of trade-offs.

### 4.2 Slot generation
- Store weekly working hours (`weekday`, `start_time`, `end_time`) in the **provider's local time zone**, plus exceptions (days off, special hours).
- Generate slots on request: for a date range, walk each day, convert local time → UTC using the provider's time zone (DST-safe, use `zoneinfo`), cut into `service.duration + buffer` steps, **subtract existing active bookings**, hide past slots and slots before `min_notice`.
- Slots are computed, **not stored** (avoids stale data). **[PROPOSED]** caching at scale.
- Show slots to the customer in their own time zone, but booking always uses UTC instants.

### 4.3 Time zones and DST
- Never store local times without a zone for appointments; store `timestamptz`.
- On DST change days a local day may have 23 or 25 hours — tests required (e.g. `America/New_York` March/November). Pakistan currently has no DST but design must still handle it.
- Non-existent local times (spring forward) are skipped; ambiguous times (fall back) resolved explicitly.

### 4.4 Cancellation and rescheduling policy
- Configurable per service: e.g. free cancellation until **N hours** before start; later cancellations marked `late_cancelled` (no fee in MVP; fee is **[MOCKED]/[PROPOSED]**).
- Reschedule allowed until N hours before; limited to X reschedules per booking.
- Status flow: `pending → confirmed → completed`, or `→ cancelled` / `no_show`. Invalid transitions return 409/422.

### 4.5 Reminders and retries
- On confirm, insert `reminder` jobs (e.g. 24h and 1h before) with `scheduled_for`.
- On reschedule/cancel: cancel old reminders and create new ones in the same Django `transaction.atomic()` block.
- Worker: Django custom management command worker (`python manage.py run_reminders`) picks due jobs using `Reminder.objects.filter(status='pending', scheduled_for__lte=now).select_for_update(skip_locked=True)`, calls the provider (mock), and marks `sent`; on failure increases `attempts`, applies exponential backoff, and caps at max attempts → `failed`.
- Idempotency: a unique key `(booking_id, channel, scheduled_for)` prevents duplicate reminders; a `sent_at` check avoids re-sending after a crash.

### 4.6 Idempotent booking
`POST /api/bookings/` accepts an `Idempotency-Key` header; a retry after a network drop returns the original result instead of creating duplicate bookings or raising false conflicts.

## 5. User Flows

**Main journey:** Provider registers → creates profile + service (30 min) + working hours → customer registers → searches provider → views available slots → books → receives (mock) confirmation → reschedules → later cancels → slot becomes available again.

**Exceptions:** slot taken meanwhile (409); booking in the past; outside working hours; service not offered by provider; cancelling too late; unauthorized access to another user's booking; duplicate submit; reminder provider failure.

## 6. Acceptance Criteria (examples)

- AC1: Two simultaneous requests for the same slot → exactly one booking exists.
- AC2: Adjacent bookings (end = next start) are allowed.
- AC3: Cancelled booking frees the slot.
- AC4: Slots respect provider time zone and DST.
- AC5: A customer cannot view or change another customer's booking.
- AC6: Reminder failure retries and never sends twice.
- AC7: Rescheduling to an occupied slot fails and keeps the original booking.

## 7. Architecture (draw in Lucidchart)

Show: Next.js Frontend (Browser / Client Components) → TLS/Reverse Proxy (Nginx) → Django + DRF API (SimpleJWT Auth) → PostgreSQL (Private Database with `btree_gist` & exclusion constraints). Django Management Worker (`python manage.py run_reminders`) → PostgreSQL `reminders` table (`SKIP LOCKED`) → (Mock) Email/SMS Provider. Optional: Object Storage (S3/Cloudinary) for provider images **[PROPOSED]**. Add trust boundaries (public / app / data), deployment region, secrets, logs/monitoring, backups.

## 8. Database Design (ERD in Lucidchart + Django Models / `schema.sql`)

Models mapped via Django ORM and PostgreSQL tables:

| Table / Model | Key fields / constraints |
|---|---|
| `users` (`CustomUser`) | id PK, email UNIQUE, password (PBKDF2/Argon2), role CHECK(customer/provider/admin), timezone |
| `providers` (`Provider`) | id PK, user_id FK UNIQUE, display_name, bio, timezone (IANA), min_notice_minutes, cancellation_hours |
| `services` (`Service`) | id PK, provider_id FK, name, duration_minutes CHECK(>0), buffer_minutes CHECK(>=0), price_amount NUMERIC CHECK(>=0), currency, is_active |
| `working_hours` (`WorkingHour`) | id PK, provider_id FK, weekday CHECK(0–6), start_time, end_time, CHECK(end>start) |
| `time_off` (`TimeOff`) | id PK, provider_id FK, start_at, end_at timestamptz, reason, CHECK(end>start) |
| `bookings` (`Booking`) | id PK, provider_id FK, service_id FK, customer_id FK, start_at, end_at timestamptz, status CHECK(...), cancelled_at, reschedule_count, idempotency_key UNIQUE(customer_id,key), **EXCLUDE no-overlap (btree_gist)** |
| `booking_events` (`BookingEvent`) | id PK, booking_id FK, event_type, old/new values, created_at (audit trail) |
| `reminders` (`Reminder`) | id PK, booking_id FK, channel, scheduled_for, status, attempts, last_error, sent_at, UNIQUE(booking_id, channel, scheduled_for) |
| `jobs` (optional) | generic queue if not using `reminders` table as queue directly |

Indexes: `bookings(provider_id, start_at)`, `bookings(customer_id, start_at)`, `reminders(status, scheduled_for)`, `working_hours(provider_id, weekday)`.

## 9. API Overview (DRF Endpoints / OpenAPI via `drf-spectacular`)

| Method | Route | Auth | Purpose |
|---|---|---|---|
| POST | /api/auth/register/ | none | Customer / Provider account registration |
| POST | /api/auth/token/ | none | SimpleJWT login (obtain access & refresh tokens) |
| POST | /api/auth/token/refresh/ | none | Refresh JWT access token |
| GET, PUT | /api/providers/me/ | provider | View / update provider profile |
| GET, POST | /api/providers/me/services/ | provider | List / create provider services |
| PUT | /api/providers/me/working-hours/ | provider | Set weekly recurring hours |
| GET, POST | /api/providers/me/time-off/ | provider | Manage vacation / blocked dates |
| GET | /api/providers/ | public / JWT | Search / list active providers |
| GET | /api/providers/{id}/slots/?service_id=&from=&to=&tz= | public / JWT | Dynamic available slot generation |
| POST | /api/bookings/ | customer (`Idempotency-Key`) | Create booking (409 on conflict) |
| GET | /api/bookings/ | JWT (owner) | List current user's bookings |
| PATCH | /api/bookings/{id}/reschedule/ | owner | Reschedule booking to new slot |
| POST | /api/bookings/{id}/cancel/ | owner / provider | Cancel booking with policy check |
| POST | /api/bookings/{id}/complete/ | provider | Mark appointment completed |
| GET | /api/health/ | none | System and DB health check |

Errors: 400 (Bad Request), 401 (Unauthorized), 403 (Forbidden), 404 (Not Found), 409 (Slot Conflict via ExclusionConstraint / Invalid Status Transition), 422 (Unprocessable Entity), 429 (Rate Limit Exceeded).

## 10. Security and Reliability

- **Role-based access control (RBAC):** DRF custom permissions (`IsCustomerUser`, `IsProviderUser`, `IsBookingOwner`) ensuring customers only access their own bookings and providers only manage their own services/schedule.
- **CORS Configuration:** `django-cors-headers` configured for Next.js frontend origin (e.g. `http://localhost:3000`).
- **Input validation:** DRF Serializers with strict validation (ISO-8601 with offset, valid IANA timezones, slot duration boundaries).
- **Rate limiting:** DRF Throttling (`rest_framework.throttling.UserRateThrottle`, `AnonRateThrottle`) on sensitive endpoints like booking creation and auth.
- **Secrets via `.env`:** `SECRET_KEY`, `DATABASE_URL`, `SIMPLE_JWT` configuration (`ACCESS_TOKEN_LIFETIME`, `REFRESH_TOKEN_LIFETIME`), `CORS_ALLOWED_ORIGINS` (names only in `.env.example`).
- **Structured logging:** Django logging with request IDs and correlation IDs; no sensitive customer data logged.
- **Database reliability:** Parameterized SQL queries via Django ORM preventing SQL injection; daily `pg_dump` backups + restore testing.
- **Personal data minimization:** Only necessary fields stored (name, email, phone).

## 5. AI Capabilities & Intelligence Layer

The platform integrates an intelligent AI layer designed to streamline client bookings, eliminate manual prep time for providers, recover lost revenue from cancellations, and automate post-session follow-ups:

### 5.1 Natural Language Smart Booking Concierge (Client-Facing)
- **Endpoint:** `POST /api/ai/concierge/`
- **Function:** Parses freeform client queries (e.g., *"Find me a 30-min legal consultation with Alex next Tuesday afternoon after 2 PM EST"*).
- **Architecture:** Extracts semantic intent (provider, service, duration, date/time window, timezone), queries the PostgreSQL dynamic slot engine, and returns ranked matching slots with 1-click reservation payloads.
- **Frontend:** Interactive AI Concierge widget accessible across client browsing pages.

### 5.2 Automated Client Intake & Pre-Meeting Briefing (Provider-Facing)
- **Endpoint:** `POST /api/ai/intake-brief/`
- **Function:** Analyzes client intake notes provided during booking alongside service metadata.
- **Architecture:** Generates an executive pre-meeting brief consisting of:
  1. Executive Problem Summary (2 sentences).
  2. Timed 30-Minute Discussion Agenda.
  3. Pre-meeting Preparation Checklist & Key Questions.
- **Frontend:** "AI Meeting Brief" button and modal on Provider Dashboard appointment cards.

### 5.3 Smart Cancellation Recovery & Instant Waitlist Matching
- **Endpoint:** `POST /api/ai/waitlist/`
- **Function:** When calendar dates or high-demand slots are filled, clients can join an intelligent waitlist specifying their preferred time window.
- **Architecture:** Whenever an existing booking is cancelled (`POST /api/bookings/{id}/cancel/`), the cancellation handler triggers the AI Waitlist Matching Engine. The engine identifies matching waitlisted clients and immediately dispatches a priority notification with a direct claim link.
- **Frontend:** "Join Waitlist" action on slot picker and automated notification alerts in customer notification center.

### 5.4 Post-Meeting Action Items & Follow-up Generator
- **Endpoint:** `POST /api/ai/meeting-followup/` & `POST /api/ai/meeting-followup/send/`
- **Function:** When a provider fulfills an appointment, they input rough takeaways or notes.
- **Architecture:** Generates a structured follow-up email draft containing session takeaways, assigned action items with deadlines (client vs provider), and a 1-click re-booking link. The provider reviews the draft and dispatches the email to the customer with one click.
- **Frontend:** Integrated directly into the Provider Dashboard "Complete Booking" modal.

---

## 11. Implemented vs Mocked vs Proposed

| Item | Status |
|---|---|
| Auth, profiles, services, hours, slots, bookings, reschedule, cancel, overlap prevention | [IMPLEMENTED] |
| AI Natural Language Smart Booking Concierge | [IMPLEMENTED] |
| AI Client Intake & Pre-Meeting Briefing | [IMPLEMENTED] |
| AI Smart Cancellation Recovery & Instant Waitlist Matching | [IMPLEMENTED] |
| AI Post-Meeting Action Items & Follow-up Generator | [IMPLEMENTED] |
| Reminder worker queue & notifications log | [IMPLEMENTED] |
| External Email/SMS gateway | [MOCKED] (pluggable architecture; logs/db records generated) |
| Payments / cancellation fees | [MOCKED]/[PROPOSED] |
| Google/Outlook calendar sync | [PROPOSED] |

## 12. Deployment and Cost Comparison

Same structure as Project 1: compare VPS (e.g. Hostinger) vs AWS for compute, DB, storage, backups, bandwidth, monitoring, queue, domain, email/SMS provider costs. **Real prices only**, with URL, date accessed, region, currency, assumptions (bookings/day, reminders/booking).

## 13. Scaling Plan

| Users | Expected changes |
|---|---|
| 100 | Single VPS; one Postgres; worker in same host. |
| 1,000 | Separate DB; indexes tuned; PgBouncer; slot-query optimisation. |
| 10,000 | Multiple API instances; cache slot lookups (short TTL) in Redis; dedicated reminder workers; read replica for search. |
| 1,000,000 | Partition `bookings` by time/provider; shard by provider/region; queue system (SQS/Kafka) for reminders; CDN; email/SMS cost and rate limits dominate; strong observability. |

State assumptions: active users %, bookings/user/month, reminders/booking, peak hour factor. Note the bottleneck per tier (hot-provider contention on the exclusion constraint, slot generation CPU, reminder burst at the hour boundary).

## 14. Testing (summary — details in `05_test-cases.xlsx`)

Include: positive full journey; negative (past date, outside hours); boundary (first/last slot, back-to-back bookings, midnight, DST days); authorization (other customer's booking); concurrency (two parallel requests → one wins); duplicate/retry (same idempotency key, reminder retry); regression after fixes. Record expected vs actual, defect IDs, evidence.

## 15. Sources and AI Disclosure

List libraries (e.g. `zoneinfo`, Django, `djangorestframework`, `djangorestframework-simplejwt`, `drf-spectacular`, `django-cors-headers`, `psycopg2-binary`, Next.js, React), licenses, pricing pages with dates, any reused code. Disclose AI use or write "None".

## 16. Known Gaps

Fill at the end. Do not claim planned features as implemented.