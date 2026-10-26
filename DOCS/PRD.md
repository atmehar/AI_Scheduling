# Product Requirements Document (PRD)
## Project: Appointment & Scheduling SaaS Platform (BookEase / SyncSlot)

---

## 1. Document Overview

| Document Attribute | Details |
|---|---|
| **Product Name** | Appointment & Scheduling SaaS |
| **Document Version** | 1.0.0 |
| **Document Status** | Approved for Implementation |
| **Target Architecture** | Django 5.x + Django REST Framework (DRF) + SimpleJWT + PostgreSQL (with `btree_gist`) + Next.js (App Router) |
| **Primary Invariant** | Absolute Zero Double-Booking Guarantee via Database-Level Exclusion Constraints |

---

## 2. Executive Summary & Problem Statement

### 2.1 The Problem
Small service businesses (health clinics, aesthetic salons, independent tutors, legal and financial consultants) lose up to 15–20% of billable hours and revenue each month due to:
1. **Inefficient Manual/Phone Bookings:** High administrative friction and time wasted manually checking diaries.
2. **Double Bookings:** Catastrophic scheduling overlaps caused by race conditions across channels or human error, resulting in client embarrassment and loss of trust.
3. **No-Shows & Late Cancellations:** Lack of automated, reliable reminder dispatches and clear cancellation policies.
4. **Timezone Miscalculations:** Confusion and missed appointments across daylight saving time (DST) shifts and client-provider timezone differences.

### 2.2 The Solution
A modern, self-service, multi-tenant scheduling SaaS platform where:
- **Service Providers** configure their business profiles, services (with individual durations and turnaround buffers), recurring weekly working hours, and vacation/blocked dates.
- **Customers** effortlessly search providers, view dynamic available appointment slots generated in real-time in their local timezone, and securely book, reschedule, or cancel appointments.
- **Core Platform Engine** provides a cryptographically and mathematically bulletproof guarantee against overlapping appointments using PostgreSQL Exclusion Constraints (`btree_gist`), handles idempotent booking submissions, and runs automated, crash-resilient background reminders.

---

## 3. Target User Personas

### Persona A: The Provider (Dr. Sarah – Wellness & Aesthetic Clinic)
- **Background:** Runs a busy wellness clinic with back-to-back 30-minute appointments requiring a 10-minute sanitation buffer between patients.
- **Pain Points:** 
  - Front-desk staff frequently books two patients into the same slot during peak calling hours.
  - Patients arrive late or cancel 15 minutes before the session without warning.
  - Needs clear weekly hours and the ability to block off holiday periods without corrupting existing bookings.
- **Needs in Platform:** Fast schedule setup, automated reminders sent to patients, strict cancellation windows (e.g., free cancellation only up to 24 hours prior), and a dashboard showing upcoming and completed sessions.

### Persona B: The Customer (Ahmed – Busy Corporate Professional)
- **Background:** Needs to book an appointment with a specialist after work hours or during breaks on his phone/laptop.
- **Pain Points:** 
  - Frustrated by "contact us for availability" forms.
  - Wants instantaneous confirmation without waiting for an email reply.
  - Needs to easily reschedule if a meeting gets moved, without having to make a phone call.
- **Needs in Platform:** Clean, mobile-responsive calendar picker, dynamic slots presented in local time, instant booking confirmation, and self-serve reschedule/cancel links.

### Persona C: Platform Administrator (Support & Oversight)
- **Background:** Technical operations and customer support supervisor.
- **Needs in Platform:** Read-level visibility into audit events, user accounts, system health, and reminder delivery status logs.

---

## 4. Product Vision, Goals & Success Metrics

### 4.1 Core Product Goals
1. **Zero Double-Booking Guarantee:** 100% guarantee that two customers cannot book overlapping times for the same provider, even if their requests hit the server in the exact same millisecond.
2. **Instant Dynamic Slot Discovery:** Real-time computation of available slots considering working hours, time-off, buffer times, existing bookings, and minimum notice periods, without storing static stale slots in the database.
3. **Seamless Rescheduling & Cancellation:** Atomic rescheduling operations that maintain the customer's original slot if the newly requested slot fails to confirm.
4. **Reliable Notification Reminders:** Zero missed reminders, zero duplicate dispatches, with automatic exponential retry backoff and crash recovery.

### 4.2 Key Performance Indicators (KPIs)
- **Booking Conflict Rate:** Exactly `0.0%` (strictly enforced by PostgreSQL).
- **Slot Discovery API Latency:** `< 150ms` (95th percentile).
- **Concurrency Test Success:** Under 10 simultaneous concurrent requests for 1 slot, exactly 1 succeeds (201 Created) and 9 fail gracefully (409 Conflict).
- **Booking Flow Completion Time:** Under 90 seconds from provider profile view to confirmed booking.

### 4.3 Scope Boundaries (MVP vs. Post-MVP)

| Feature Area | In-Scope (MVP Target) | Out-of-Scope (Post-MVP / Future) |
|---|---|---|
| **Authentication** | Email + Password, SimpleJWT (Access + Refresh tokens), Role-based (Provider, Customer, Admin) | Social OAuth (Google/Apple), SAML SSO |
| **Provider Profile** | Bio, timezone (IANA), minimum booking notice, cancellation policy hours | Multi-location chains, staff member assignment |
| **Service Catalog** | Name, duration (minutes), buffer (minutes), price, currency, active toggle | Package deals, recurring subscriptions |
| **Scheduling Engine** | Weekly recurring hours, date-specific time-off, dynamic slot generator, DST-safe conversions | Multi-service chaining in a single appointment |
| **Booking Engine** | Atomic booking, PostgreSQL exclusion constraint, 409 conflict detection, idempotency key support | Split payments, deposits, live credit card processing (Stripe) |
| **Rescheduling/Cancel** | Self-serve reschedule (atomic), policy-enforced cancellation (free vs late cancelled) | Waitlist auto-promotions |
| **Reminders** | Mocked notification provider (structured DB + log dispatches), PostgreSQL queue with `SKIP LOCKED`, exponential backoff | Real Twilio SMS gateway, SendGrid live production email delivery |
| **Integrations** | Next.js REST API consumption, OpenAPI 3.0 via `drf-spectacular` | 2-way Google Calendar / Outlook sync, Zoom/Google Meet auto-links |

---

## 5. Comprehensive User Journeys

```
                           +-----------------------------------------------+
                           |         PROVIDER JOURNEY                      |
                           | 1. Register & Verify Account                  |
                           | 2. Configure Profile & IANA Timezone          |
                           | 3. Create Services (Duration + Buffer)        |
                           | 4. Define Weekly Operating Hours & Time-Off   |
                           +-----------------------+-----------------------+
                                                   |
                                                   v
                           +-----------------------------------------------+
                           |         CUSTOMER JOURNEY                      |
                           | 1. Discover Provider & Select Service         |
                           | 2. Pick Available Date & Dynamic Time Slot    |
                           | 3. Submit Booking (Atomic & Idempotent)       |
                           | 4. Instant Confirmation & Reminder Scheduled  |
                           +-----------------------+-----------------------+
                                                   |
                        +--------------------------+--------------------------+
                        |                                                     |
                        v                                                     v
          +-----------------------------+                       +-----------------------------+
          |      RESCHEDULE FLOW        |                       |      CANCELLATION FLOW      |
          | - Select New Target Slot    |                       | - Check Cancellation Policy |
          | - Atomic DB Swap            |                       | - Within Policy: Cancelled  |
          | - Old Slot freed only if ok |                       | - Late Cancel: Flagged      |
          | - Reminders Rescheduled     |                       | - Slot immediately freed   |
          +-----------------------------+                       +-----------------------------+
```

### 5.1 Journey 1: Provider Onboarding & Setup
1. Provider navigates to `/register`, selects role `Provider`, enters email, name, password, and local timezone (e.g., `Asia/Karachi` or `America/New_York`).
2. Logs in via `/login` and receives SimpleJWT tokens.
3. Accesses Provider Dashboard `/provider/settings`:
   - Configures Minimum Notice (e.g., 60 minutes).
   - Configures Cancellation Window (e.g., 24 hours).
4. Navigates to `/provider/services`:
   - Adds "Initial Consultation" (45 min duration + 15 min buffer).
   - Adds "Follow-up Session" (20 min duration + 10 min buffer).
5. Navigates to `/provider/availability`:
   - Sets Monday–Friday 09:00 to 17:00.
   - Blocks upcoming Friday afternoon (Time-Off override).

### 5.2 Journey 2: Customer Discovery & Dynamic Booking
1. Customer visits `/providers`, searches by service or provider name, and selects Dr. Sarah.
2. Selects "Initial Consultation" (45 min).
3. The frontend queries `/api/providers/{id}/slots/?service_id=1&from=2026-11-01&to=2026-11-07&tz=Asia/Karachi`.
4. Engine computes slots on-the-fly: converts provider hours to UTC, removes buffers, checks existing active bookings, and discards past slots.
5. Customer picks Monday 10:00 AM slot.
6. Frontend sends `POST /api/bookings/` with UUID `Idempotency-Key` header.
7. Backend verifies availability within an atomic transaction. PostgreSQL checks the `no_overlap` Exclusion Constraint.
8. Booking is marked `confirmed`. Confirmation event is logged, and 2 reminder jobs (24h before, 1h before) are inserted into the queue.

### 5.3 Journey 3: High-Concurrency Conflict (The Double-Booking Test)
1. Customer A and Customer B both view Monday 10:00 AM slot simultaneously.
2. Both click "Confirm Booking" at the exact same fraction of a second.
3. Server receives both requests concurrently:
   - Request A acquires the slot and successfully commits.
   - Request B violates PostgreSQL exclusion constraint `no_overlap`.
4. Database raises an `IntegrityError` on Request B.
5. DRF custom exception handler captures this error and returns:
   - **HTTP 409 Conflict:** `{"error": "slot_conflict", "detail": "This slot has just been booked by another user. Please select another slot."}`
6. Customer B's Next.js UI automatically refreshes the slot picker and informs them of the conflict without application crash.

### 5.4 Journey 4: Customer Rescheduling
1. Customer goes to `/my-bookings` and selects their upcoming Monday 10:00 AM booking.
2. Clicks "Reschedule", picks Tuesday 02:00 PM.
3. Frontend issues `PATCH /api/bookings/{id}/reschedule/` with new slot parameters.
4. Backend opens a single `transaction.atomic()`:
   - Evaluates exclusion constraint on the new time range.
   - Updates `start_at` and `end_at`.
   - Increments `reschedule_count`.
   - Automatically revokes previous scheduled reminders and queues updated reminders.
5. If the new slot has a conflict, the transaction rolls back completely; the Monday 10:00 AM slot remains safely booked.

### 5.5 Journey 5: Cancellation with Policy Enforcement
1. Customer requests cancellation via `POST /api/bookings/{id}/cancel/`.
2. Backend computes time remaining: `time_to_appointment = start_at - now()`.
3. If `time_to_appointment >= cancellation_hours`:
   - Status transitions to `cancelled`.
4. If `time_to_appointment < cancellation_hours`:
   - Status transitions to `late_cancelled`.
5. In both cases, because status is no longer `pending` or `confirmed`, the PostgreSQL exclusion constraint immediately frees the slot for other customers.
6. Pending reminders are cancelled.

---

## 6. Detailed Functional Requirements

| Requirement ID | Module | Title | Description & Acceptance Criteria |
|---|---|---|---|
| **FR-AUTH-01** | Auth | User Registration | Supports registration for Customer and Provider roles with email validation, password hashing (PBKDF2/Argon2), and default timezone. |
| **FR-AUTH-02** | Auth | SimpleJWT Token Auth | Login endpoint issuing standard `access` (short-lived) and `refresh` (long-lived) tokens. Includes token refresh endpoint. |
| **FR-AUTH-03** | Auth | Role-Based Access Control | Enforces DRF permissions (`IsCustomer`, `IsProvider`, `IsAdminUser`, and object-level ownership). |
| **FR-PROV-01** | Provider | Profile Management | Provider can update display name, bio, IANA timezone string, minimum notice in minutes, and cancellation notice hours. |
| **FR-SERV-01** | Services | Service Catalog CRUD | Provider can create, update, list, and soft-delete/deactivate services with fields: name, duration_minutes (>0), buffer_minutes (>=0), price, currency. |
| **FR-SCHED-01** | Availability | Weekly Working Hours | Provider can specify daily schedules: weekday (0-6), start_time, end_time, ensuring `end_time > start_time`. |
| **FR-SCHED-02** | Availability | Time-Off / Blocked Dates | Provider can add blackout date ranges (`start_at`, `end_at`, reason) in UTC, ensuring `end_at > start_at`. |
| **FR-SLOT-01** | Engine | Dynamic Slot Generator | System dynamically generates valid start/end slots for a requested service within date bounds. Converts provider hours to UTC, factors buffer, excludes active bookings, excludes time-off, and filters out slots starting before `now() + min_notice_minutes`. |
| **FR-SLOT-02** | Engine | DST Compliance | Handles Daylight Saving Time transitions gracefully (23h or 25h local days) using Python's standard `zoneinfo` module. |
| **FR-BOOK-01** | Booking | Atomic Booking Creation | Creates booking records within `transaction.atomic()`. Validates service ownership and slot boundary alignment. |
| **FR-BOOK-02** | Booking | PostgreSQL Overlap Defense | Enforces `EXCLUDE USING gist` constraint on active bookings. Returns HTTP 409 Conflict upon collision. |
| **FR-BOOK-03** | Booking | Idempotency Key Handling | Accepts and stores `Idempotency-Key` header. Prevents duplicate booking creation on network drop retries. |
| **FR-BOOK-04** | Booking | Reschedule Transaction | Changes slot timing within a single transaction. Retains original booking if new slot conflicts. |
| **FR-BOOK-05** | Booking | Cancellation Policy Engine | Validates notice window against provider's `cancellation_hours`. Sets status to `cancelled` or `late_cancelled` and releases slot immediately. |
| **FR-AUDT-01** | Audit | Booking Events Trail | Automatically writes immutable log to `booking_events` on create, reschedule, cancel, or completion. |
| **FR-NOTIF-01** | Notifications| Reminder Scheduler | Schedules 24h and 1h reminders upon booking confirmation. |
| **FR-WORK-01** | Worker | Safe Background Worker | Django management command worker (`python manage.py run_reminders`) uses `select_for_update(skip_locked=True)` to safely process reminders without duplicates. Implements exponential backoff on mock errors. |
| **FR-FE-01** | Frontend | Provider Dashboard | Next.js interface for managing profile, services, hours, time-off, and viewing upcoming bookings. |
| **FR-FE-02** | Frontend | Customer Booking UI | Next.js dynamic calendar slot picker showing slots in user's timezone, instant confirmation modal, and `/my-bookings` portal. |

---

## 7. Non-Functional Requirements (NFRs)

### 7.1 Data Consistency & Concurrency
- The system must ensure zero booking overlap under all conditions. Database-level constraints must be the single source of truth, eliminating race condition bugs common in multi-threaded application layers.

### 7.2 Performance & Responsiveness
- Slot Generation Endpoint: `< 200ms` for a 7-day query range.
- Booking Creation Endpoint: `< 250ms` end-to-end.
- Next.js UI Initial Load: Fast First Contentful Paint (FCP) `< 1.2s`.

### 7.3 Security & Protection
- Authentication: Secure stateless JWT with cryptographic signature (`HMAC-SHA256`).
- Password Security: Django standard PBKDF2 with SHA-256 (390,000+ iterations) or Argon2.
- Data Isolation: Customers cannot view, list, or manipulate bookings belonging to another customer under any circumstances.
- CORS Configuration: Restrict API access to trusted Next.js origin (`http://localhost:3000` or production domain) via `django-cors-headers`.
- SQL Injection & Parameterization: 100% ORM-parameterized queries.
- Secrets: No credentials or tokens hardcoded in code; strictly loaded from `.env`.

### 7.4 Reliability & Fault Tolerance
- Background worker crashes during reminder processing must not lose jobs or cause double-sending.
- Database connection drops during slot booking must cleanly rollback, maintaining pristine database integrity.

---

## 8. UX & UI Specifications (Next.js Application)

### 8.1 Visual Aesthetic & Design System
- **Theme:** Clean, modern, trustworthy medical/professional SaaS theme.
- **Color Palette:** Deep indigo / slate primary (`#1E293B`, `#4F46E5`), crisp white cards, emerald green confirmation accents (`#10B981`), and clear amber/rose alert states.
- **Typography:** Modern sans-serif (Inter / Outfit) via Next.js Google Fonts.
- **Components:** Glassmorphism headers, responsive calendar grid, interactive slot chips with hover states, intuitive status badges.

### 8.2 Page Architecture & Sitemap
```
/ (Landing Page - Hero, Features, Provider Directory)
/login (SimpleJWT authentication)
/register (Role selection: Customer vs. Provider)
/providers (Search & filter providers)
/providers/[id] (Provider public page, services list & slot picker widget)
/my-bookings (Customer portal: view bookings, reschedule, cancel)
/dashboard (Provider portal: schedule, services, working hours, appointments)
/dashboard/services (Service CRUD)
/dashboard/availability (Weekly hours & time-off management)
```

---

## 9. Release Milestones & Delivery Roadmap

| Milestone | Target Deliverable | Description |
|---|---|---|
| **Phase 0** | Project Setup & Repo | Django + DRF + Next.js repository initialization, Docker Compose for PostgreSQL, `.env.example`. |
| **Phase 1** | Requirements & Specs | PRD, SRS, and architecture documentation finalized. |
| **Phase 2** | Architecture & DB Design | Lucidchart architecture diagram, ERD, `schema.sql`, PostgreSQL `btree_gist` constraint verification. |
| **Phase 3** | Core Backend Implementation | SimpleJWT Auth, Provider settings, Services, Slot generation engine, atomic booking, reschedule, cancel. |
| **Phase 4** | Background Worker & Reminders | Django management command worker with `SKIP LOCKED`, mock email/SMS dispatch, exponential retry. |
| **Phase 5** | Frontend Development | Next.js dynamic client: provider dashboard, dynamic slot picker widget, customer bookings manager. |
| **Phase 6** | Security, QA & Concurrency Tests | Concurrency test script (10 parallel requests), QA test matrix (`05_test-cases.xlsx`). |
| **Phase 7** | Hosting, Cost Analysis & Scaling | Hostinger VPS vs. AWS multi-tier infrastructure cost models (`08_cost-and-scaling.xlsx`). |
| **Phase 8** | Final Deliverables & Video Demo | System documentation, engineering decision logs, and recorded walkthrough. |
