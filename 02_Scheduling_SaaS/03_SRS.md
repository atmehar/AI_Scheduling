# Software Requirements Specification (SRS)
## Project: Appointment & Scheduling SaaS Platform (BookEase / SyncSlot)
### Standard: IEEE Std 830-1998 Compliant Specification

---

## 1. Introduction

### 1.1 Purpose
The purpose of this Software Requirements Specification (SRS) document is to establish a comprehensive technical foundation for the development of an enterprise-grade **Appointment & Scheduling SaaS platform**. This document outlines the functional modules, data architecture, security posture, concurrency mechanisms, and external interface specifications for both the backend (**Django REST Framework**) and frontend (**Next.js**) systems, backed by **PostgreSQL**.

### 1.2 Scope of the Software
The platform is a multi-tenant appointment scheduling solution designed for small-to-medium service businesses (such as medical clinics, salons, law firms, and private consultants). 
- **Core Functionality:** Provider onboarding, customizable services (with turnaround buffers), recurring weekly availability schedules, time-off blocking, dynamic conflict-free slot generation, atomic booking creation with zero overlap guarantees, self-serve atomic rescheduling, policy-enforced cancellation, and an automated background reminder worker.
- **Critical Architectural Guarantee:** The system eliminates appointment double-booking at the database layer using PostgreSQL exclusion constraints (`btree_gist`), guaranteeing zero race conditions even under concurrent load.
- **Out of Scope (MVP):** Production payment gateway integration (Stripe/PayPal), live telephony SMS gateways (mocked via structured log/DB dispatch), and two-way Google Calendar / Outlook synchronization.

### 1.3 Definitions, Acronyms, and Abbreviations

| Term / Acronym | Definition |
|---|---|
| **DRF** | Django REST Framework (toolkit for building Web APIs in Django) |
| **SimpleJWT** | JSON Web Token authentication plugin for Django REST Framework |
| **PostgreSQL** | Open-source relational database management system supporting advanced spatial and range indexing |
| **GiST** | Generalized Search Tree (an index method in PostgreSQL supporting arbitrary indexing schemes) |
| **btree_gist** | PostgreSQL extension enabling GiST indexing for scalar data types (e.g., integers, UUIDs) alongside ranges |
| **tstzrange** | PostgreSQL range type representing a range of timestamps with time zone (`[start, end)`) |
| **Half-Open Range** | Mathematical interval notation `[start, end)` inclusive of the start instant and exclusive of the end instant |
| **IANA Timezone** | Standardized timezone identifier format (e.g., `Asia/Karachi`, `America/New_York`) managed by tzdata |
| **DST** | Daylight Saving Time (seasonal clock shift requiring timezone-aware conversion) |
| **SKIP LOCKED** | PostgreSQL locking clause allowing concurrent workers to bypass locked rows and prevent thread contention |
| **Idempotency** | Property of an API operation where making identical multiple requests yields the same state and outcome |

### 1.4 References
- IEEE Std 830-1998: IEEE Recommended Practice for Software Requirements Specifications.
- PostgreSQL Documentation: Chapter on Range Types and Exclusion Constraints.
- Django Documentation (5.x): Model constraints, migrations, and `django.contrib.postgres`.
- Django REST Framework Documentation: Serializers, ViewSets, Throttling, and Custom Exception Handlers.
- Next.js 14/15 Documentation: App Router, Server Components, and Client Interactivity.

---

## 2. Overall Description

### 2.1 Product Perspective & System Topology

```
+-----------------------------------------------------------------------------------+
|                                 CLIENT LAYER                                      |
|            Next.js App Router (React, Tailwind CSS, Lucide Icons)                 |
|            - Provider Management Dashboard                                        |
|            - Customer Dynamic Slot Picker & Booking Portal                        |
+------------------------------------------+----------------------------------------+
                                           | HTTPS / JSON (Bearer JWT)
                                           v
+-----------------------------------------------------------------------------------+
|                             API GATEWAY / REVERSE PROXY                           |
|                      Nginx / TLS Termination / Static Asset Cache                 |
+------------------------------------------+----------------------------------------+
                                           | HTTP (Reverse Proxy)
                                           v
+-----------------------------------------------------------------------------------+
|                            APPLICATION LAYER (DJANGO DRF)                         |
|  - django-cors-headers (CORS Filtering)                                           |
|  - SimpleJWT Authentication & RBAC Permissions (IsCustomer, IsProvider)           |
|  - Dynamic Slot Generator Engine (Python zoneinfo + DST calculations)             |
|  - Booking & Rescheduling Transactions (transaction.atomic)                       |
|  - Custom Exception Handler (Catch IntegrityError -> 409 Conflict)                |
|  - Background Worker Command (python manage.py run_reminders)                     |
+------------------------------------------+----------------------------------------+
                                           | PostgreSQL Protocol
                                           v
+-----------------------------------------------------------------------------------+
|                              DATABASE LAYER (POSTGRESQL)                          |
|  - btree_gist extension                                                           |
|  - Exclusion Constraint: EXCLUDE USING gist (provider_id =, tstzrange &&)         |
|  - FOR UPDATE SKIP LOCKED queue consumption                                       |
|  - Audit logging & event storage (booking_events)                                 |
+-----------------------------------------------------------------------------------+
```

### 2.2 User Characteristics
- **Customer:** Non-technical end-users booking services on mobile or desktop browsers. Requires an intuitive, zero-friction booking interface with instant feedback and clear error states.
- **Provider:** Small business owners or operators managing daily schedules. Requires a clean administrative dashboard to configure services, view appointments, and update working hours.
- **Admin:** Technical support personnel reviewing audit trails, resolving orphaned bookings, and monitoring system uptime.

### 2.3 General Constraints
1. **Database Constraint:** Must run PostgreSQL 14+ with `btree_gist` extension enabled.
2. **Time Handling:** All persistent timestamps must be stored in UTC (`timestamptz`). Provider local times must be converted using standard IANA timezone databases via Python `zoneinfo`.
3. **Stateless Backend:** Backend must not maintain in-memory sessions; all authentication relies on stateless JSON Web Tokens.
4. **Single-Transaction Guarantees:** Rescheduling operations must execute in a single atomic database transaction. If the target slot is unavailable, the entire transaction rolls back, preserving the original booking.

---

## 3. Detailed Data Models & Database Architecture

### 3.1 Relational Schema Diagram & Django Models

```
   +------------------+         1:1         +--------------------+
   |   CustomUser     |-------------------->|      Provider      |
   | - id (PK)        |                     | - id (PK)          |
   | - email (UNIQUE) |                     | - user_id (FK, UQ) |
   | - password       |                     | - display_name     |
   | - role           |                     | - timezone (IANA)  |
   | - timezone       |                     | - min_notice_min   |
   +--------+---------+                     | - cancel_hours     |
            |                               +---------+----------+
            | 1:N                                     |
            v                                         | 1:N
   +------------------+                               +-------------------------+
   |     Booking      |<------------------------------+                         |
   | - id (PK)        |                               |                         |
   | - customer_id(FK)|                 1:N           v           1:N           v
   | - provider_id(FK)|        +-------------------+  |  +--------------------+ |
   | - service_id(FK) |        |    WorkingHour    |  |  |      Service       | |
   | - start_at (UTC) |        | - id (PK)         |  |  | - id (PK)          | |
   | - end_at (UTC)   |        | - weekday (0-6)   |  |  | - name             | |
   | - status         |        | - start_time      |  |  | - duration_minutes | |
   | - idempotency_key|        | - end_time        |  |  | - buffer_minutes   | |
   +--------+---------+        +-------------------+  |  | - price, currency  | |
            |                                         v  +--------------------+ |
            | 1:N                            +-----------------+                |
            |                                |     TimeOff     |                |
            |                                | - id (PK)       |                |
            |                                | - start_at (UTC)|<---------------+
            |                                | - end_at (UTC)  |
            +------------------+             +-----------------+
            |                  |
            v 1:N              v 1:N
   +-----------------+  +-----------------+
   |  BookingEvent   |  |    Reminder     |
   | - id (PK)       |  | - id (PK)       |
   | - event_type    |  | - channel       |
   | - old_values    |  | - scheduled_for |
   | - new_values    |  | - status        |
   +-----------------+  +-----------------+
```

### 3.2 Table Definitions & Django Model Specifications

#### 3.2.1 `users` Table (`CustomUser` Model)
Represents identity credentials and core roles for customers, providers, and admins.
- `id`: `BIGSERIAL PRIMARY KEY` (or `UUID`)
- `email`: `VARCHAR(255) UNIQUE NOT NULL`
- `password`: `VARCHAR(255) NOT NULL` (Hashed via PBKDF2/Argon2)
- `role`: `VARCHAR(20) NOT NULL CHECK (role IN ('customer', 'provider', 'admin'))`
- `timezone`: `VARCHAR(64) NOT NULL DEFAULT 'UTC'`
- `first_name`: `VARCHAR(150)`
- `last_name`: `VARCHAR(150)`
- `is_active`: `BOOLEAN NOT NULL DEFAULT TRUE`
- `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`

#### 3.2.2 `providers` Table (`Provider` Model)
Extended business profile for providers.
- `id`: `BIGSERIAL PRIMARY KEY`
- `user_id`: `BIGINT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE`
- `display_name`: `VARCHAR(255) NOT NULL`
- `bio`: `TEXT DEFAULT ''`
- `timezone`: `VARCHAR(64) NOT NULL DEFAULT 'UTC'` (Validated against IANA list)
- `min_notice_minutes`: `INT NOT NULL DEFAULT 60 CHECK (min_notice_minutes >= 0)`
- `cancellation_hours`: `INT NOT NULL DEFAULT 24 CHECK (cancellation_hours >= 0)`
- `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`

#### 3.2.3 `services` Table (`Service` Model)
Offerings published by providers.
- `id`: `BIGSERIAL PRIMARY KEY`
- `provider_id`: `BIGINT NOT NULL REFERENCES providers(id) ON DELETE CASCADE`
- `name`: `VARCHAR(255) NOT NULL`
- `duration_minutes`: `INT NOT NULL CHECK (duration_minutes > 0)`
- `buffer_minutes`: `INT NOT NULL DEFAULT 0 CHECK (buffer_minutes >= 0)`
- `price_amount`: `NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (price_amount >= 0)`
- `currency`: `VARCHAR(3) NOT NULL DEFAULT 'USD'`
- `is_active`: `BOOLEAN NOT NULL DEFAULT TRUE`
- `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`

#### 3.2.4 `working_hours` Table (`WorkingHour` Model)
Weekly recurring operational schedule in provider local time.
- `id`: `BIGSERIAL PRIMARY KEY`
- `provider_id`: `BIGINT NOT NULL REFERENCES providers(id) ON DELETE CASCADE`
- `weekday`: `SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6)` (0 = Monday, 6 = Sunday)
- `start_time`: `TIME NOT NULL`
- `end_time`: `TIME NOT NULL`
- **Constraint:** `CHECK (end_time > start_time)`
- **Index:** `CREATE INDEX idx_working_hours_provider_day ON working_hours(provider_id, weekday);`

#### 3.2.5 `time_off` Table (`TimeOff` Model)
Blackout dates or vacation periods in UTC.
- `id`: `BIGSERIAL PRIMARY KEY`
- `provider_id`: `BIGINT NOT NULL REFERENCES providers(id) ON DELETE CASCADE`
- `start_at`: `TIMESTAMPTZ NOT NULL`
- `end_at`: `TIMESTAMPTZ NOT NULL`
- `reason`: `VARCHAR(255) DEFAULT ''`
- **Constraint:** `CHECK (end_at > start_at)`

#### 3.2.6 `bookings` Table (`Booking` Model) — The Core Invariant
- `id`: `BIGSERIAL PRIMARY KEY`
- `provider_id`: `BIGINT NOT NULL REFERENCES providers(id) ON DELETE RESTRICT`
- `customer_id`: `BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT`
- `service_id`: `BIGINT NOT NULL REFERENCES services(id) ON DELETE RESTRICT`
- `start_at`: `TIMESTAMPTZ NOT NULL`
- `end_at`: `TIMESTAMPTZ NOT NULL`
- `status`: `VARCHAR(30) NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'late_cancelled', 'no_show'))`
- `cancelled_at`: `TIMESTAMPTZ NULL`
- `reschedule_count`: `INT NOT NULL DEFAULT 0`
- `idempotency_key`: `UUID NOT NULL`
- `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`

**PostgreSQL Exclusion Constraint Definition:**
```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE bookings ADD CONSTRAINT no_overlap_active_bookings
  EXCLUDE USING gist (
    provider_id WITH =,
    tstzrange(start_at, end_at, '[)') WITH &&
  ) WHERE (status IN ('pending', 'confirmed'));
```
- **Constraint Rule:** For any two records with the same `provider_id`, their `tstzrange` intervals cannot overlap (`&&`) if both are active (`pending` or `confirmed`).
- **Half-Open Intervals `[)`:** `[10:00, 10:30)` and `[10:30, 11:00)` do **not** overlap, allowing continuous back-to-back appointments.
- **Indexes:**
  - `CREATE UNIQUE INDEX uq_customer_idempotency ON bookings(customer_id, idempotency_key);`
  - `CREATE INDEX idx_bookings_provider_start ON bookings(provider_id, start_at);`
  - `CREATE INDEX idx_bookings_customer_start ON bookings(customer_id, start_at);`

#### 3.2.7 `booking_events` Table (`BookingEvent` Model)
Audit trail logging every state transition.
- `id`: `BIGSERIAL PRIMARY KEY`
- `booking_id`: `BIGINT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE`
- `event_type`: `VARCHAR(50) NOT NULL` (`created`, `rescheduled`, `cancelled`, `completed`)
- `old_values`: `JSONB NULL`
- `new_values`: `JSONB NULL`
- `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`

#### 3.2.8 `reminders` Table (`Reminder` Model)
Queue table for automated notifications.
- `id`: `BIGSERIAL PRIMARY KEY`
- `booking_id`: `BIGINT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE`
- `channel`: `VARCHAR(20) NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'sms'))`
- `scheduled_for`: `TIMESTAMPTZ NOT NULL`
- `status`: `VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled'))`
- `attempts`: `INT NOT NULL DEFAULT 0`
- `max_attempts`: `INT NOT NULL DEFAULT 3`
- `last_error`: `TEXT NULL`
- `sent_at`: `TIMESTAMPTZ NULL`
- `created_at`: `TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- **Unique Constraint:** `UNIQUE (booking_id, channel, scheduled_for)`
- **Index:** `CREATE INDEX idx_reminders_status_scheduled ON reminders(status, scheduled_for) WHERE status = 'pending';`

---

## 4. Algorithmic Specifications

### 4.1 Dynamic Slot Generation Algorithm

```
INPUTS:
  provider_id: ID of the service provider
  service_id: ID of the selected service
  query_start_date: Start date of search window (YYYY-MM-DD)
  query_end_date: End date of search window (YYYY-MM-DD)
  customer_tz_str: Customer requested display timezone (e.g. 'Asia/Karachi')

ALGORITHM:
  1. Retrieve Provider (with provider.timezone, min_notice_minutes).
  2. Retrieve Service (with duration_minutes, buffer_minutes).
     step_duration = service.duration_minutes + service.buffer_minutes
  3. Load all WorkingHour records for provider_id.
  4. Load all active Bookings for provider_id between query_start_date and query_end_date (status IN ('pending', 'confirmed')).
  5. Load all TimeOff records for provider_id covering the range.
  6. Calculate cutoff_instant = UTC_NOW() + timedelta(minutes=min_notice_minutes).
  7. Initialize available_slots = []
  
  8. FOR each day in [query_start_date ... query_end_date]:
       day_of_week = day.weekday()  # 0 = Monday ... 6 = Sunday
       matching_hours = [wh for wh in WorkingHour if wh.weekday == day_of_week]
       
       FOR each schedule in matching_hours:
         # Construct timezone-aware local timestamps using provider.timezone
         local_start = datetime.combine(day, schedule.start_time, tzinfo=ZoneInfo(provider.timezone))
         local_end   = datetime.combine(day, schedule.end_time,   tzinfo=ZoneInfo(provider.timezone))
         
         # Convert to UTC instants
         utc_cursor = local_start.astimezone(ZoneInfo("UTC"))
         utc_schedule_end = local_end.astimezone(ZoneInfo("UTC"))
         
         WHILE utc_cursor + timedelta(minutes=service.duration_minutes) <= utc_schedule_end:
           slot_start = utc_cursor
           slot_end = slot_start + timedelta(minutes=service.duration_minutes)
           buffer_end = slot_start + timedelta(minutes=step_duration)
           
           # Check 1: Minimum Notice Cutoff
           IF slot_start < cutoff_instant:
             utc_cursor = buffer_end
             CONTINUE
             
           # Check 2: Overlap with Existing Bookings
           # Booking overlaps if: max(slot_start, b.start_at) < min(buffer_end, b.end_at)
           has_booking_overlap = ANY(
             b for b in active_bookings 
             if max(slot_start, b.start_at) < min(buffer_end, b.end_at)
           )
           
           # Check 3: Overlap with Provider Time-Off
           has_timeoff_overlap = ANY(
             t for t in time_offs 
             if max(slot_start, t.start_at) < min(buffer_end, t.end_at)
           )
           
           IF NOT has_booking_overlap AND NOT has_timeoff_overlap:
             # Convert to customer timezone for presentation
             display_start = slot_start.astimezone(ZoneInfo(customer_tz_str))
             display_end = slot_end.astimezone(ZoneInfo(customer_tz_str))
             
             available_slots.append({
               "start_at": slot_start.isoformat(),
               "end_at": slot_end.isoformat(),
               "display_start": display_start.strftime("%Y-%m-%d %H:%M"),
               "display_end": display_end.strftime("%H:%M")
             })
             
           # Advance cursor by duration + buffer
           utc_cursor = buffer_end

OUTPUT:
  Return JSON array of available_slots
```

### 4.2 Overlap Prevention & Concurrency Resolution
When two concurrent requests $R_1$ and $R_2$ attempt to book the same slot:
1. Both requests arrive at Django views in separate worker processes/threads.
2. Both views execute inside `transaction.atomic()`.
3. Request $R_1$ executes `INSERT INTO bookings ...`. PostgreSQL checks GiST index on `no_overlap_active_bookings`. No collision found; row is written and committed.
4. Request $R_2$ executes `INSERT INTO bookings ...`. PostgreSQL detects collision with $R_1$'s range:
   $$\text{overlap} = (R_2.\text{start\_at} < R_1.\text{end\_at}) \land (R_2.\text{end\_at} > R_1.\text{start\_at})$$
5. PostgreSQL raises `ExclusionViolation` (`IntegrityError` in Python).
6. Django automatically rolls back $R_2$'s transaction.
7. DRF custom exception handler intercepts `IntegrityError`, matches constraint name `no_overlap_active_bookings`, and serializes a clean HTTP **409 Conflict**:
   ```json
   {
     "error": "slot_conflict",
     "detail": "The requested appointment slot has already been booked. Please choose an alternate slot."
   }
   ```

### 4.3 Atomic Reschedule Algorithm
```python
@transaction.atomic
def reschedule_booking(booking_id, new_start_at, customer_user):
    # Lock the booking row for update
    booking = Booking.objects.select_for_update().get(id=booking_id, customer=customer_user)
    
    # 1. Validate status transition
    if booking.status not in ['confirmed', 'pending']:
        raise ValidationError("Cannot reschedule a cancelled or completed booking.")
        
    duration = booking.service.duration_minutes
    new_end_at = new_start_at + timedelta(minutes=duration)
    
    # 2. Update timestamps
    old_start = booking.start_at
    booking.start_at = new_start_at
    booking.end_at = new_end_at
    booking.reschedule_count += 1
    booking.save() # PostgreSQL exclusion constraint is evaluated here
    
    # 3. Log Audit Trail
    BookingEvent.objects.create(
        booking=booking,
        event_type="rescheduled",
        old_values={"start_at": str(old_start)},
        new_values={"start_at": str(new_start_at)}
    )
    
    # 4. Atomically adjust reminders
    Reminder.objects.filter(booking=booking, status='pending').update(status='cancelled')
    schedule_reminders(booking)
    
    return booking
```

### 4.4 Background Queue Processing Worker (`SKIP LOCKED`)
The worker runs via Django management command `python manage.py run_reminders`:
```python
def process_reminders_batch():
    now = timezone.now()
    with transaction.atomic():
        # Atomically select and lock up to 50 due reminders without blocking other workers
        due_reminders = list(
            Reminder.objects
            .filter(status='pending', scheduled_for__lte=now)
            .select_for_update(skip_locked=True)[:50]
        )
        
        for reminder in due_reminders:
            try:
                # Mark as processing
                reminder.status = 'processing'
                reminder.attempts += 1
                reminder.save(update_fields=['status', 'attempts'])
                
                # Execute notification dispatch (Mock logger / DB dispatch)
                mock_notification_service.send(
                    channel=reminder.channel,
                    recipient=reminder.booking.customer.email,
                    subject=f"Appointment Reminder: {reminder.booking.service.name}",
                    body=f"Your appointment starts at {reminder.booking.start_at.strftime('%Y-%m-%d %H:%M UTC')}"
                )
                
                reminder.status = 'sent'
                reminder.sent_at = timezone.now()
                reminder.save(update_fields=['status', 'sent_at'])
                
            except Exception as exc:
                reminder.last_error = str(exc)
                if reminder.attempts >= reminder.max_attempts:
                    reminder.status = 'failed'
                else:
                    # Exponential backoff: retry in 2^(attempts) * 60 seconds
                    backoff_seconds = (2 ** reminder.attempts) * 60
                    reminder.scheduled_for = timezone.now() + timedelta(seconds=backoff_seconds)
                    reminder.status = 'pending'
                reminder.save(update_fields=['status', 'last_error', 'scheduled_for'])
```

---

## 5. API Endpoints & Interface Specifications

All endpoints are prefixed with `/api/`. Standard authentication header:
`Authorization: Bearer <access_token>`

### 5.1 Authentication Endpoints

#### 1. `POST /api/auth/register/`
- **Auth:** Public
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "SecurePassword123!",
    "role": "customer",
    "timezone": "Asia/Karachi",
    "first_name": "Ahmed",
    "last_name": "Khan"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "id": 1,
    "email": "user@example.com",
    "role": "customer",
    "timezone": "Asia/Karachi"
  }
  ```

#### 2. `POST /api/auth/token/` (SimpleJWT Login)
- **Auth:** Public
- **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "SecurePassword123!"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "access": "eyJhbGciOi...",
    "refresh": "eyJhbGciOi...",
    "user": {
      "id": 1,
      "email": "user@example.com",
      "role": "customer"
    }
  }
  ```

#### 3. `POST /api/auth/token/refresh/`
- **Auth:** Public
- **Request Body:** `{"refresh": "eyJhbGciOi..."}`
- **Response (200 OK):** `{"access": "eyJhbGciOi..."}`

---

### 5.2 Provider Profile & Availability Endpoints

#### 4. `GET, PUT /api/providers/me/`
- **Auth:** `IsAuthenticated` & `IsProvider`
- **Request Body (PUT):**
  ```json
  {
    "display_name": "Dr. Sarah Wellness",
    "bio": "Certified specialist in sports medicine.",
    "timezone": "America/New_York",
    "min_notice_minutes": 120,
    "cancellation_hours": 24
  }
  ```

#### 5. `GET, POST /api/providers/me/services/`
- **Auth:** `IsAuthenticated` & `IsProvider`
- **Request Body (POST):**
  ```json
  {
    "name": "General Consultation",
    "duration_minutes": 30,
    "buffer_minutes": 10,
    "price_amount": "75.00",
    "currency": "USD"
  }
  ```

#### 6. `PUT /api/providers/me/working-hours/`
- **Auth:** `IsAuthenticated` & `IsProvider`
- **Request Body:**
  ```json
  [
    {"weekday": 0, "start_time": "09:00:00", "end_time": "17:00:00"},
    {"weekday": 1, "start_time": "09:00:00", "end_time": "17:00:00"},
    {"weekday": 2, "start_time": "09:00:00", "end_time": "17:00:00"},
    {"weekday": 3, "start_time": "09:00:00", "end_time": "17:00:00"},
    {"weekday": 4, "start_time": "09:00:00", "end_time": "15:00:00"}
  ]
  ```

#### 7. `POST, GET /api/providers/me/time-off/`
- **Auth:** `IsAuthenticated` & `IsProvider`
- **Request Body (POST):**
  ```json
  {
    "start_at": "2026-11-20T00:00:00Z",
    "end_at": "2026-11-25T23:59:59Z",
    "reason": "Annual Medical Conference"
  }
  ```

---

### 5.3 Customer Discovery & Booking Endpoints

#### 8. `GET /api/providers/`
- **Auth:** Public
- **Query Params:** `?search=wellness`
- **Response (200 OK):** Array of provider profiles with active services.

#### 9. `GET /api/providers/{id}/slots/`
- **Auth:** Public
- **Query Params:** `?service_id=1&from=2026-11-01&to=2026-11-07&tz=Asia/Karachi`
- **Response (200 OK):**
  ```json
  {
    "provider_id": 1,
    "service_id": 1,
    "timezone": "Asia/Karachi",
    "slots": [
      {
        "start_at": "2026-11-02T04:00:00Z",
        "end_at": "2026-11-02T04:30:00Z",
        "display_start": "2026-11-02 09:00",
        "display_end": "09:30"
      },
      {
        "start_at": "2026-11-02T04:40:00Z",
        "end_at": "2026-11-02T05:10:00Z",
        "display_start": "2026-11-02 09:40",
        "display_end": "10:10"
      }
    ]
  }
  ```

#### 10. `POST /api/bookings/`
- **Auth:** `IsAuthenticated` (Customer)
- **Headers:** `Idempotency-Key: 7b846e32-2d14-41d6-84d1-583cf93f5be7`
- **Request Body:**
  ```json
  {
    "provider_id": 1,
    "service_id": 1,
    "start_at": "2026-11-02T04:00:00Z"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "id": 101,
    "provider": {"id": 1, "name": "Dr. Sarah Wellness"},
    "service": {"id": 1, "name": "General Consultation", "duration": 30},
    "start_at": "2026-11-02T04:00:00Z",
    "end_at": "2026-11-02T04:30:00Z",
    "status": "confirmed"
  }
  ```
- **Conflict Error Response (409 Conflict):**
  ```json
  {
    "error": "slot_conflict",
    "detail": "The requested appointment slot has already been booked. Please choose an alternate slot."
  }
  ```

#### 11. `PATCH /api/bookings/{id}/reschedule/`
- **Auth:** `IsAuthenticated` (Booking Owner)
- **Request Body:**
  ```json
  {
    "new_start_at": "2026-11-03T05:00:00Z"
  }
  ```
- **Response (200 OK):** Updated booking object.

#### 12. `POST /api/bookings/{id}/cancel/`
- **Auth:** `IsAuthenticated` (Booking Owner or Provider)
- **Response (200 OK):**
  ```json
  {
    "id": 101,
    "status": "cancelled",
    "cancelled_at": "2026-10-24T18:00:00Z",
    "message": "Booking has been successfully cancelled within the free cancellation window."
  }
  ```

#### 13. `GET /api/health/`
- **Auth:** Public
- **Response (200 OK):** `{"status": "healthy", "database": "connected", "timestamp": "2026-10-24T18:00:00Z"}`

---

## 6. Security, Reliability & Quality Attributes

### 6.1 Authentication & Token Hygiene
- **Access Token Lifetime:** 15 minutes (short-lived to minimize exposure).
- **Refresh Token Lifetime:** 7 days with token rotation enabled in SimpleJWT (`ROTATE_REFRESH_TOKENS = True`).
- **Cryptographic Hash:** Password storage hashed using Django default PBKDF2 with SHA-256 (390,000 rounds) or Argon2id.

### 6.2 Cross-Origin Resource Sharing (CORS)
- `django-cors-headers` explicitly whitelists the Next.js frontend origin (`CORS_ALLOWED_ORIGINS = ['http://localhost:3000', 'https://your-domain.com']`).
- `CORS_ALLOW_CREDENTIALS = True`.
- `CORS_ALLOW_HEADERS` permits `Authorization`, `Content-Type`, and `Idempotency-Key`.

### 6.3 API Throttling & Abuse Prevention
- Configured via DRF Throttling:
  - Anonymous users: `AnonRateThrottle` (60 requests/minute).
  - Authenticated users: `UserRateThrottle` (300 requests/minute).
  - Booking Creation Endpoint: Custom Scoped Throttle `10 requests/minute` to mitigate denial-of-service slot grabbing.

### 6.4 Concurrency Benchmark Specification
- **Test Objective:** Validate that 10 asynchronous concurrent HTTP `POST /api/bookings/` requests targeting the exact same provider slot produce:
  - Exactly **1 success** (HTTP 201 Created).
  - Exactly **9 conflicts** (HTTP 409 Conflict).
  - Database contains exactly **1 booking record** for that slot.
  - Zero unhandled 500 server errors.

---

## 7. Verification & Acceptance Test Traceability Matrix

| Test ID | SRS Requirement | Test Scenario | Expected Result |
|---|---|---|---|
| **TC-01** | FR-BOOK-02 | Concurrency Test (10 simultaneous requests for slot $S$) | 1 succeeds (201), 9 return 409 Conflict. Exactly 1 row in DB. |
| **TC-02** | 3.2.6 (Half-Open `[)`) | Back-to-back booking (10:00–10:30 and 10:30–11:00) | Both bookings succeed (201). No constraint violation. |
| **TC-03** | 4.3 (Reschedule) | Reschedule to an occupied slot | Transaction rolls back. Old slot remains confirmed. 409 returned. |
| **TC-04** | 4.4 (Cancel) | Cancellation 48 hours prior ($> 24h$ threshold) | Status set to `cancelled`. Slot immediately appears in slot search. |
| **TC-05** | 4.4 (Cancel) | Cancellation 2 hours prior ($< 24h$ threshold) | Status set to `late_cancelled`. Slot freed in DB. |
| **TC-06** | 4.1 (Timezone & DST)| Slots generated across US Fall Back (Nov 2026) | Local day produces 25 hours. All slots accurately mapped to UTC. |
| **TC-07** | 4.4 (Worker) | Background worker kills mid-flight | Row lock released. Re-run worker processes reminder without duplicate. |
| **TC-08** | 6.2 (RBAC) | Customer A attempts `GET /api/bookings/{Customer_B_ID}/` | HTTP 403 Forbidden or 404 Not Found. |
| **TC-09** | 5.3 (Idempotency) | Retry same booking submission with identical `Idempotency-Key` | Second request returns original booking payload (200/201), no duplicate created. |
