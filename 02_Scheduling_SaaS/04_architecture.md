# System Modules Specification (Modules.md)
## Project: Appointment & Scheduling SaaS Platform
### Target Architecture: Django 5 (DRF) + SimpleJWT + PostgreSQL (`btree_gist`) + Next.js (App Router)

---

## 1. System Modular Architecture Overview

The system is architected into decoupled, domain-driven modules across the **Django Backend** and the **Next.js Frontend**. Each module encapsulates its own data models, business logic, API interfaces, and presentation components.

```
+---------------------------------------------------------------------------------------------------------+
|                                        FRONTEND MODULES (NEXT.JS)                                       |
|  +--------------------+  +--------------------+  +--------------------+  +---------------------------+  |
|  |  MOD-FE-01: CORE   |  |  MOD-FE-02: AUTH   |  | MOD-FE-03: PROVIDER|  |    MOD-FE-04: BOOKING     |  |
|  |  - Design System   |  |  - Login/Register  |  |  - Dashboard       |  |  - Provider Directory     |  |
|  |  - Axios API Client|  |  - Auth Context    |  |  - Service Manager |  |  - Dynamic Slot Picker    |  |
|  |  - Token Refresh   |  |  - Role Guards     |  |  - Hours & TimeOff |  |  - My Bookings / Resched  |  |
|  +--------------------+  +--------------------+  +--------------------+  +---------------------------+  |
+----------------------------------------------------+----------------------------------------------------+
                                                     | HTTPS / REST APIs
                                                     v
+---------------------------------------------------------------------------------------------------------+
|                                        BACKEND MODULES (DJANGO DRF)                                     |
|  +--------------------+  +--------------------+  +--------------------+  +---------------------------+  |
|  |  MOD-BE-01: CORE   |  |  MOD-BE-02: ACCOUNTS| | MOD-BE-03: PROVIDERS| |    MOD-BE-04: SCHEDULING   |  |
|  |  - Base Models     |  |  - Custom User     |  |  - Provider Profile|  |  - Dynamic Slot Engine    |  |
|  |  - Exception Handlr|  |  - SimpleJWT Auth  |  |  - Service Catalog |  |  - Atomic Booking Engine  |  |
|  |  - Timezone Utils  |  |  - Role Permissions|  |  - Hours & TimeOff |  |  - Exclusion Constraint   |  |
|  +--------------------+  +--------------------+  +--------------------+  +---------------------------+  |
|                                                                                        |                |
|                                                                          +-------------v-------------+  |
|                                                                          |    MOD-BE-05: WORKER      |  |
|                                                                          |  - Reminders Queue        |  |
|                                                                          |  - SKIP LOCKED Dispatcher |  |
|                                                                          |  - Mock Notification Svc  |  |
|                                                                          +---------------------------+  |
+----------------------------------------------------+----------------------------------------------------+
                                                     | PostgreSQL GiST / SQL
                                                     v
+---------------------------------------------------------------------------------------------------------+
|                                             DATABASE (POSTGRESQL)                                       |
|  - Extension: btree_gist                                                                                |
|  - Table Constraints: EXCLUDE USING gist (provider_id =, tstzrange(start_at, end_at, '[)') &&)          |
|  - Concurrency Lock: FOR UPDATE SKIP LOCKED                                                             |
+---------------------------------------------------------------------------------------------------------+
```

---

## 2. Backend Modules Breakdown (Django REST Framework)

---

### Module BE-01: Core & Common Infrastructure (`apps.core`)

#### 1. Purpose & Responsibilities
Provides cross-cutting utilities, custom database fields, unified API exception handling (specifically translating PostgreSQL exclusion violations into HTTP 409 Conflict), logging middleware, and timezone helpers.

#### 2. Key Components & Files
- `apps/core/models.py`: Abstract `TimeStampedModel` (`created_at`, `updated_at`).
- `apps/core/exceptions.py`: `custom_exception_handler` capturing `IntegrityError` (ExclusionConstraint violation) and formatting standard error payloads.
- `apps/core/pagination.py`: Standard pagination class (`StandardResultsSetPagination`).
- `apps/core/utils/timezone.py`: Helpers for converting between provider IANA timezones and UTC.
- `apps/core/views.py`: `HealthCheckView` (`/api/health/`) verifying database connectivity.

#### 3. Core Logic & Invariant
```python
# apps/core/exceptions.py
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
from django.db import IntegrityError

def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)
    
    # Intercept PostgreSQL Exclusion Constraint Violations
    if isinstance(exc, IntegrityError) and "no_overlap_active_bookings" in str(exc):
        return Response(
            {
                "error": "slot_conflict",
                "detail": "This appointment slot has already been booked by another user. Please select an alternate slot."
            },
            status=status.HTTP_409_CONFLICT
        )
    return response
```

---

### Module BE-02: Authentication & User Identity (`apps.accounts`)

#### 1. Purpose & Responsibilities
Manages user identity, registration, password hashing, SimpleJWT token issuance/refresh, and role-based authorization permissions.

#### 2. Data Models
- **`CustomUser`** (`AbstractBaseUser`, `PermissionsMixin`):
  - `email` (`EmailField`, unique, indexed)
  - `role` (`CharField`: `'customer'`, `'provider'`, `'admin'`)
  - `timezone` (`CharField`: default `'UTC'`)
  - `first_name`, `last_name` (`CharField`)
  - `is_active` (`BooleanField`: default `True`)
  - `is_staff` (`BooleanField`: default `False`)

#### 3. API Endpoints
| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/register/` | Public | Register customer or provider |
| `POST` | `/api/auth/token/` | Public | Obtain SimpleJWT access & refresh tokens |
| `POST` | `/api/auth/token/refresh/` | Public | Refresh expired access token |
| `GET` | `/api/auth/me/` | Authenticated | Retrieve authenticated user profile |

#### 4. Permissions Classes
- `IsCustomer`: `request.user.role == 'customer'`
- `IsProvider`: `request.user.role == 'provider'`
- `IsOwnerOrReadOnly`: Validates object-level ownership.

---

### Module BE-03: Provider & Service Management (`apps.providers`)

#### 1. Purpose & Responsibilities
Enables service providers to maintain their public profile, define their catalog of services (with durations and turnaround buffers), configure recurring weekly operating hours, and record vacation/blackout periods.

#### 2. Data Models
- **`Provider`**:
  - `user` (`OneToOneField(CustomUser)`)
  - `display_name` (`CharField(255)`)
  - `bio` (`TextField`)
  - `timezone` (`CharField(64)`: e.g. `'Asia/Karachi'`, `'America/New_York'`)
  - `min_notice_minutes` (`PositiveIntegerField`: default `60`)
  - `cancellation_hours` (`PositiveIntegerField`: default `24`)
- **`Service`**:
  - `provider` (`ForeignKey(Provider)`)
  - `name` (`CharField(255)`)
  - `duration_minutes` (`PositiveIntegerField`, `> 0`)
  - `buffer_minutes` (`PositiveIntegerField`, `>= 0`)
  - `price_amount` (`DecimalField(10, 2)`)
  - `currency` (`CharField(3)`: default `'USD'`)
  - `is_active` (`BooleanField`: default `True`)
- **`WorkingHour`**:
  - `provider` (`ForeignKey(Provider)`)
  - `weekday` (`SmallIntegerField`: 0=Monday, 6=Sunday)
  - `start_time` (`TimeField`)
  - `end_time` (`TimeField`)
  - Constraint: `CHECK (end_time > start_time)`
- **`TimeOff`**:
  - `provider` (`ForeignKey(Provider)`)
  - `start_at` (`DateTimeField`: UTC)
  - `end_at` (`DateTimeField`: UTC)
  - `reason` (`CharField(255)`)
  - Constraint: `CHECK (end_at > start_at)`

#### 3. API Endpoints
| Method | Path | Auth | Description |
|---|---|---|---|
| `GET, PUT` | `/api/providers/me/` | Provider | Read/Update provider profile & timezone |
| `GET, POST` | `/api/providers/me/services/` | Provider | List/Create services |
| `PUT, DELETE`| `/api/providers/me/services/{id}/` | Provider | Update/Deactivate service |
| `GET, PUT` | `/api/providers/me/working-hours/`| Provider | Retrieve/Bulk update weekly schedule |
| `GET, POST` | `/api/providers/me/time-off/` | Provider | List/Add vacation and blackout dates |
| `DELETE` | `/api/providers/me/time-off/{id}/`| Provider | Delete a blackout date |
| `GET` | `/api/providers/` | Public | List & search active providers |
| `GET` | `/api/providers/{id}/` | Public | Retrieve public provider profile & active services |

---

### Module BE-04: Scheduling & Booking Engine (`apps.scheduling`)

#### 1. Purpose & Responsibilities
The central nervous system of the platform. Responsible for:
1. Dynamic, on-the-fly generation of conflict-free appointment slots (DST-safe, buffer-aware, notice-aware).
2. Atomic booking creation with database-enforced zero-overlap exclusion constraints (`btree_gist`).
3. Idempotent request protection via `Idempotency-Key` headers.
4. Atomic rescheduling (ensuring rollback if the target slot has a collision).
5. Cancellation policy enforcement (determining standard `cancelled` vs. `late_cancelled`).
6. Writing immutable audit events (`booking_events`).

#### 2. Data Models
- **`Booking`**:
  - `provider` (`ForeignKey(Provider)`)
  - `customer` (`ForeignKey(CustomUser)`)
  - `service` (`ForeignKey(Service)`)
  - `start_at` (`DateTimeField`: UTC)
  - `end_at` (`DateTimeField`: UTC)
  - `status` (`CharField`: `'pending'`, `'confirmed'`, `'completed'`, `'cancelled'`, `'late_cancelled'`, `'no_show'`)
  - `cancelled_at` (`DateTimeField`, null)
  - `reschedule_count` (`PositiveIntegerField`: default 0)
  - `idempotency_key` (`UUIDField`)
  - **PostgreSQL Exclusion Constraint:**
    ```python
    ExclusionConstraint(
        name='no_overlap_active_bookings',
        expressions=[
            ('provider', RangeOperators.EQUAL),
            ('booking_range', RangeOperators.OVERLAPS),
        ],
        condition=Q(status__in=['pending', 'confirmed']),
    )
    ```
- **`BookingEvent`**:
  - `booking` (`ForeignKey(Booking)`)
  - `event_type` (`CharField`: `'created'`, `'rescheduled'`, `'cancelled'`, `'completed'`)
  - `old_values` (`JSONField`, null)
  - `new_values` (`JSONField`, null)
  - `created_at` (`DateTimeField`: auto_now_add)

#### 3. Dynamic Slot Generation Algorithm Logic
- Takes `provider_id`, `service_id`, `from_date`, `to_date`, and `customer_tz`.
- Iterates each day in the date range.
- Matches `WorkingHour` records for that weekday.
- Converts provider local time boundaries to UTC using Python standard `zoneinfo.ZoneInfo(provider.timezone)`.
- Slices the time block into steps of `service.duration_minutes + service.buffer_minutes`.
- Eliminates any slot that starts before `now() + provider.min_notice_minutes`.
- Eliminates any slot overlapping with active bookings or `TimeOff` ranges.
- Formats surviving slots with both UTC timestamps and localized `display_start`/`display_end` strings.

#### 4. API Endpoints
| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/providers/{id}/slots/` | Public | Dynamic slot calculation engine |
| `POST` | `/api/bookings/` | Customer | Create booking (requires `Idempotency-Key`) |
| `GET` | `/api/bookings/` | Authenticated | List bookings (Customer sees own; Provider sees theirs) |
| `GET` | `/api/bookings/{id}/` | Owner | Retrieve single booking detail |
| `PATCH`| `/api/bookings/{id}/reschedule/`| Owner | Atomic reschedule to new slot |
| `POST` | `/api/bookings/{id}/cancel/` | Owner/Provider | Cancel booking with policy check |
| `POST` | `/api/bookings/{id}/complete/`| Provider | Mark appointment completed |

---

### Module BE-05: Notifications & Worker Queue (`apps.notifications`)

#### 1. Purpose & Responsibilities
Provides automated appointment reminders and dispatch queuing without requiring heavy external brokers (like Celery/RabbitMQ) for MVP. Uses PostgreSQL row locking with `SKIP LOCKED` to safely pick, process, and retry reminder jobs with exponential backoff.

#### 2. Data Models
- **`Reminder`**:
  - `booking` (`ForeignKey(Booking)`)
  - `channel` (`CharField`: `'email'`, `'sms'`: default `'email'`)
  - `scheduled_for` (`DateTimeField`: UTC)
  - `status` (`CharField`: `'pending'`, `'processing'`, `'sent'`, `'failed'`, `'cancelled'`)
  - `attempts` (`PositiveIntegerField`: default 0)
  - `max_attempts` (`PositiveIntegerField`: default 3)
  - `last_error` (`TextField`, null)
  - `sent_at` (`DateTimeField`, null)
  - Constraint: `UNIQUE (booking_id, channel, scheduled_for)`

#### 3. Worker Implementation (`apps/notifications/management/commands/run_reminders.py`)
- Executes continuously or via cron/timer.
- Atomically selects due reminders:
  ```python
  Reminder.objects.filter(status='pending', scheduled_for__lte=timezone.now()).select_for_update(skip_locked=True)[:50]
  ```
- Calls `MockNotificationService` (which logs the formatted message to stdout and records dispatch timestamp).
- On failure, increments `attempts` and applies exponential backoff:
  $$\Delta t = 2^{\text{attempts}} \times 60 \text{ seconds}$$

---

## 3. Frontend Modules Breakdown (Next.js App Router)

---

### Module FE-01: Core UI & Infrastructure (`frontend/src/core`)
- **Theme & Design System:** Tailwind CSS / Vanilla CSS configuration with a modern, slate/indigo color palette, typography (Inter/Outfit), and Lucide icons.
- **API Client (`lib/api.ts`):** Central Axios instance with request/response interceptors automatically attaching SimpleJWT `Bearer` tokens and handling token refreshes.
- **Layout & Navigation:** Shared header, user dropdown, mobile menu, and notification toasts.

---

### Module FE-02: Authentication & User State (`frontend/src/auth`)
- **Context & State (`context/AuthContext.tsx`):** Holds authenticated user object, token storage in cookies/localStorage, login, register, and logout methods.
- **Route Guards (`components/ProtectedRoute.tsx`):** Protects provider dashboard routes (`/dashboard/*`) and customer booking pages (`/my-bookings`).
- **Pages:**
  - `/login`: Email & password form with error messaging.
  - `/register`: Registration form with toggle between "Customer" and "Service Provider".

---

### Module FE-03: Provider Management Suite (`frontend/src/provider`)
- **Pages & Components:**
  - `/dashboard`: High-level summary of upcoming appointments and statistics.
  - `/dashboard/services`: Service catalog editor (add/edit/delete service, set duration, buffer, and price).
  - `/dashboard/availability`: Interactive 7-day weekly schedule editor (set start and end hours per day).
  - `/dashboard/time-off`: Date picker to block out holidays or conferences.
  - `/dashboard/appointments`: Filterable appointment list (mark complete, cancel).

---

### Module FE-04: Customer Booking & Management Suite (`frontend/src/booking`)
- **Pages & Components:**
  - `/providers`: Provider directory with search by provider name or service type.
  - `/providers/[id]`: Public provider landing page showcasing bio, services, and the interactive booking widget.
  - **Dynamic Slot Picker Widget (`SlotPicker.tsx`):**
    - Step 1: Service selection.
    - Step 2: Calendar date selection.
    - Step 3: Dynamic slots grid (fetches `/api/providers/{id}/slots/` in real-time).
    - Step 4: Review & Confirm with instant feedback.
    - Conflict Modal: Handles 409 Conflict gracefully by re-fetching slots and prompting the user.
  - `/my-bookings`: Customer appointments dashboard:
    - View upcoming and past appointments.
    - Reschedule modal (picks a new slot and calls `/reschedule/`).
    - Cancel modal (displays warning if cancelling past the free cancellation window).

---

## 4. Inter-Module Dependency & Call Graph

```
                                  +-------------------+
                                  |    MOD-BE-01      |
                                  |   (Core/Common)   |
                                  +---------+---------+
                                            |
                         +------------------+------------------+
                         |                                     |
                         v                                     v
               +-------------------+                 +-------------------+
               |    MOD-BE-02      |                 |    MOD-BE-03      |
               | (Accounts/Auth)   |                 | (Providers/Serv)  |
               +---------+---------+                 +---------+---------+
                         |                                     |
                         +------------------+------------------+
                                            |
                                            v
                                  +-------------------+
                                  |    MOD-BE-04      |
                                  | (Scheduling/Book) |
                                  +---------+---------+
                                            |
                                            v
                                  +-------------------+
                                  |    MOD-BE-05      |
                                  | (Reminders/Queue) |
                                  +-------------------+
```

---

## 5. Development & Implementation Roadmap

| Sequence | Module Target | Key Deliverable |
|---|---|---|
| **Step 1** | **Setup & Infrastructure** | Initialize Django project, install `djangorestframework`, `djangorestframework-simplejwt`, `psycopg2-binary`, `django-cors-headers`, `drf-spectacular`. Configure Docker Compose for PostgreSQL with `btree_gist`. |
| **Step 2** | **MOD-BE-01 & MOD-BE-02** | Implement `CustomUser`, SimpleJWT endpoints, custom permissions, and base exception handlers. |
| **Step 3** | **MOD-BE-03** | Implement `Provider`, `Service`, `WorkingHour`, and `TimeOff` models, migrations, serializers, and CRUD viewsets. |
| **Step 4** | **MOD-BE-04 (Slot Generator)** | Implement the dynamic slot calculation engine with `zoneinfo` DST handling, buffers, and notice cutoffs. |
| **Step 5** | **MOD-BE-04 (Booking Engine)** | Implement `Booking` model with PostgreSQL `no_overlap_active_bookings` ExclusionConstraint, atomic create/reschedule/cancel endpoints, and 409 error mapping. |
| **Step 6** | **MOD-BE-05 (Worker)** | Implement `Reminder` model and the Django management command `python manage.py run_reminders` with `SKIP LOCKED`. |
| **Step 7** | **MOD-FE-01 & MOD-FE-02** | Initialize Next.js project with App Router, Tailwind CSS, API client, and AuthContext. |
| **Step 8** | **MOD-FE-03** | Build Provider Dashboard (Profile, Services, Weekly Hours, Time-Off). |
| **Step 9** | **MOD-FE-04** | Build Customer Discovery, Dynamic Slot Picker Widget, and My Bookings Management Portal. |
| **Step 10**| **Concurrency & QA Testing**| Run 10-thread parallel booking concurrency test script to verify exactly 1 success and 9 conflicts (409). |
