# Engineering Rules & Architectural Guidelines (rules.md)
## Project: Appointment & Scheduling SaaS Platform
### Target Stack: Django 5 (DRF) + SimpleJWT + PostgreSQL (`btree_gist`) + Next.js (App Router)

> **Full Documentation Reference:** See [DOCS/rules.md](file:///f:/Projects/Weekend%20Assesment%202/AI_Scheduling/DOCS/rules.md)

---

## 1. Core Philosophy & Golden Rule

> **Golden Rule:** Simplicity, modularity, and database-level data integrity over clever hacks. Never rely on application-level locks alone when a database constraint can guarantee correctness. Keep components small, decoupled, and strictly under the line limit.

---

## 2. File Length & Modular Architecture Constraints

### 2.1 The 600-Line Code Limit (Hard Ceiling)
- **Rule:** **No single file in this codebase (backend or frontend) shall ever exceed 600 lines of code.**
- **Soft Target:** Strive to keep most files under **250–350 lines**.
- **Refactoring Trigger:** If any file reaches 400 lines during development, proactively decompose it into smaller sub-modules before adding new features.

### 2.2 Modular Architecture & Single Responsibility Principle (SRP)
- Every file, class, component, and module must have **one and only one reason to change**.
- Avoid "god objects", monolithic `views.py`, giant `models.py`, or huge 800-line React components.

#### Backend Decomposition Strategy:
- When `views.py` grows:
  - Decompose into a `views/` package (e.g. `views/auth_views.py`, `views/slot_views.py`, `views/booking_views.py`).
- When `serializers.py` grows:
  - Decompose into a `serializers/` package (e.g. `serializers/request_serializers.py`, `serializers/response_serializers.py`).
- When business logic increases:
  - Move logic out of views and models into dedicated `services/` (e.g. `services/slot_engine.py`, `services/cancellation_service.py`).

#### Frontend Decomposition Strategy:
- When a page component grows:
  - Break the page into **Atomic Components**:
    - **UI Atoms:** `Button.tsx`, `Badge.tsx`, `Input.tsx`, `Modal.tsx`, `Spinner.tsx`.
    - **Molecules:** `SlotChip.tsx`, `TimeRangeInput.tsx`, `ServiceCard.tsx`.
    - **Organisms:** `SlotPickerGrid.tsx`, `WeeklyScheduleEditor.tsx`, `MyBookingsTable.tsx`.
    - **Custom Hooks:** Extract state and API calls into `hooks/useSlots.ts`, `hooks/useBookings.ts`, `hooks/useAuth.ts`.

---

## 3. Backend Development Rules (Django & DRF)

### 3.1 Service Layer Pattern (Thin Views, Clean Services)
- **Views/ViewSets:** Responsible **only** for HTTP parsing, authentication/permissions, calling serializers, invoking domain services, and returning standard HTTP responses.
- **Serializers:** Responsible **only** for input validation, type coercion, and JSON serialization.
- **Services (`apps/<app>/services/`):** Pure Python domain logic (slot generation, cancellation fee check, reminder scheduling).

### 3.2 Database Integrity & Concurrency Invariant
1. **Zero Double-Booking Guarantee:**
   - Double-booking prevention is strictly enforced by PostgreSQL using `btree_gist` and `EXCLUDE USING gist`:
     ```sql
     ALTER TABLE bookings ADD CONSTRAINT no_overlap_active_bookings
       EXCLUDE USING gist (
         provider_id WITH =,
         tstzrange(start_at, end_at, '[)') WITH &&
       ) WHERE (status IN ('pending', 'confirmed'));
     ```
   - Application logic must never bypass or replace this constraint.
2. **Standard 409 Conflict Response:**
   - The DRF custom exception handler (`apps.core.exceptions.custom_exception_handler`) must intercept PostgreSQL `IntegrityError` referencing `no_overlap_active_bookings` and return:
     ```json
     {
       "error": "slot_conflict",
       "detail": "This appointment slot has already been booked by another user. Please select an alternate slot."
     }
     ```
     with **HTTP Status 409 Conflict**.
3. **Atomic Transactions:**
   - Any operation altering booking status or timing (`create_booking`, `reschedule_booking`, `cancel_booking`) must be wrapped inside `django.db.transaction.atomic()`.
   - In rescheduling: If the new slot fails, the transaction must roll back completely so that the customer's original slot remains safely booked.

### 3.3 Timezone & UTC Strict Rules
- **Database Storage:** Always store timestamps as UTC (`DateTimeField` with `USE_TZ = True`).
- **Forbidden:** Never use Python's naive `datetime.now()` or `datetime.utcnow()`. Always use `django.utils.timezone.now()`.
- **Provider Timezones:** Stored as valid IANA timezone strings (e.g. `Asia/Karachi`, `America/New_York`).
- **Calculations:** Use Python's standard `zoneinfo.ZoneInfo` for local-to-UTC and DST conversions. Do not use deprecated `pytz`.
- **Customer Output:** Accept an optional `tz` query parameter (e.g. `?tz=Asia/Karachi`) to format display strings (`display_start`, `display_end`), but always keep the canonical `start_at` and `end_at` in ISO-8601 UTC format.

### 3.4 Background Worker & Queue Safety
- The reminder worker (`python manage.py run_reminders`) must use PostgreSQL's `select_for_update(skip_locked=True)` within an atomic block:
  ```python
  Reminder.objects.filter(status='pending', scheduled_for__lte=now).select_for_update(skip_locked=True)[:50]
  ```
- **Crash Safety:** If a worker terminates mid-flight, uncommitted transactions must release row locks automatically.
- **Retry Backoff:** Exponential backoff ($2^{\text{attempts}} \times 60\text{s}$) with a hard cap at `max_attempts = 3`. Never create infinite retry loops.

---

## 4. Frontend Development Rules (Next.js & React)

### 4.1 Server Components vs. Client Components
- **Default to Server Components (RSC):** Use Server Components for static marketing pages, layouts, and data pre-fetching.
- **Use `"use client"` only when necessary:** For browser APIs, interactive state (`useState`, `useEffect`), and event handling.

### 4.2 Centralized API Client & Token Interceptors
- All API requests to the Django DRF backend must go through `src/lib/api.ts` (Axios instance).
- Automatically attach `Authorization: Bearer <access_token>`.
- Automatically catch `401 Unauthorized` and perform silent refresh via `/api/auth/token/refresh/`.

### 4.3 Graceful Concurrency & Conflict UX
- When a booking returns **HTTP 409 Conflict**:
  - The UI must **never crash** or display an unformatted JSON error.
  - Display a clean warning dialog/toast: *"This slot was just taken by another user. We've refreshed the schedule for you."*
  - Automatically re-trigger the slot fetcher to remove the contested slot from view.

---

## 5. Security & Authentication Rules

| Security Layer | Standard Required |
|---|---|
| **Passwords** | Django default PBKDF2 with SHA-256 (390,000 rounds) or Argon2. Never plain text. |
| **Tokens** | SimpleJWT with 15-minute access token lifetime and 7-day refresh token rotation. |
| **RBAC** | Explicit DRF permissions on every view (`IsAuthenticated`, `IsCustomer`, `IsProvider`, `IsOwner`). |
| **CORS** | `django-cors-headers` strictly whitelisting Next.js origins (`http://localhost:3000`). |
| **Idempotency** | UUID `Idempotency-Key` required on `POST /api/bookings/` to prevent duplicate submissions. |
| **Rate Limiting** | DRF throttles: `AnonRateThrottle` (60/min), `UserRateThrottle` (300/min), Booking endpoint (10/min). |
| **Secrets** | Zero secrets in git. Strictly loaded via `.env` with a populated `.env.example` template. |

---

## 6. Testing & Verification Checklist

Before considering any task or module complete, verify against this checklist:
- [ ] **Line Limit Check:** No file exceeds 600 lines of code.
- [ ] **Exclusion Constraint Test:** PostgreSQL rejects overlapping bookings for the same provider.
- [ ] **409 Error Translation:** Collision produces HTTP 409 Conflict with `slot_conflict` code.
- [ ] **Atomic Reschedule:** If new slot is blocked, original booking remains intact.
- [ ] **DST Handling:** Provider timezone accurately generates slots across daylight saving time shifts.
- [ ] **Concurrency Benchmark:** 10 simultaneous requests for 1 slot produce exactly 1 success and 9 conflicts.
- [ ] **Idempotent Retries:** Duplicate `Idempotency-Key` does not duplicate bookings.
- [ ] **Worker Queue:** Background worker picks jobs with `SKIP LOCKED` and does not block concurrent workers.
- [ ] **Responsive UI:** Next.js booking widget works seamlessly on mobile and desktop.
