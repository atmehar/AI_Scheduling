# 07 - Source Structure & Live Demo Script

This document details the codebase navigation structure and provides a comprehensive, step-by-step **3–5 minute demonstration script** for presenting the **TimeSync AI Scheduling SaaS** system.

---

## 1. Codebase Structure & Key Source Locations

```
AI_Scheduling/
├── 01_README.md                    # Primary setup, running, and architecture guide
├── 05_test-cases.xlsx              # Comprehensive QA test execution spreadsheet (20 tests)
├── 06_engineering-decisions.md     # Engineering trade-offs (Exclusion vs Locks, UTC vs Local)
├── 07_source_and_demo.md           # Source navigation and 3-5 min demo script (This file)
├── 08_cost-and-scaling.xlsx        # Real vendor pricing & 100 to 1M user scale models
├── 09_sources-and-disclosure.md    # Disclosures, citations, and vendor URLs
├── DOCS/                           # Complete specifications (PRD, SRS, Modules, API Spec)
│   ├── PRD.md                      # Product Requirements Document
│   ├── SRS.md                      # IEEE 830 System Requirements Specification
│   ├── Modules.md                  # Decomposition (BE-01..05, FE-01..04)
│   ├── rules.md                    # Coding standards (600-line ceiling, thin views)
│   ├── api-spec.md                 # Complete OpenAPI/REST API contract
│   ├── backup-restore.md           # Disaster recovery runbook
│   └── concurrency_test_evidence.txt # 10-thread parallel collision output log
├── backend/                        # Django REST Framework Backend
│   ├── config/                     # Django core settings, urls, wsgi
│   ├── apps/
│   │   ├── core/                   # TimeStampedModel, custom 409 exception handler, /health
│   │   ├── accounts/               # CustomUser, SimpleJWT auth, role permissions
│   │   ├── providers/              # Provider, Service, WorkingHour, TimeOff models & APIs
│   │   ├── scheduling/             # Booking, Slot Generator, BookingService, Exclusion Constraints
│   │   └── notifications/          # Reminder model, MockNotificationProvider, run_reminders command
│   ├── scripts/
│   │   ├── test_concurrency.py     # 10-thread collision benchmark script
│   │   ├── backup.ps1              # Automated PostgreSQL backup dump
│   │   └── restore.ps1             # Automated PostgreSQL restore script
│   └── manage.py
└── frontend/                       # Next.js App Router Frontend (React / pure JavaScript)
    ├── src/
    │   ├── app/
    │   │   ├── page.jsx            # Landing page with hero & featured specialists
    │   │   ├── login/page.jsx      # Authentication login with quick-fill demo buttons
    │   │   ├── register/page.jsx   # Role toggle (customer vs provider) & detected timezone
    │   │   ├── providers/page.jsx  # Searchable provider directory
    │   │   ├── providers/[id]/page.jsx # Provider profile & slot booking page
    │   │   ├── my-bookings/page.jsx # Customer appointment portal (reschedule & cancel)
    │   │   └── dashboard/          # Provider management suite
    │   │       ├── page.jsx        # Metrics & appointment completion/cancellation
    │   │       ├── services/page.jsx # Service catalog CRUD
    │   │       └── availability/page.jsx # 7-day recurring hours & time-off blackouts
    │   ├── components/
    │   │   ├── booking/SlotPicker.jsx # Real-time slot picker with 409 conflict dialog
    │   │   └── ui/                 # Navbar, Footer, Modal, Badge
    │   ├── context/AuthContext.jsx # JWT lifecycle & persistence context
    │   └── lib/api.js              # Axios client with silent 401 token refresh
    ├── package.json
    └── next.config.mjs
```

---

## 2. 3–5 Minute Video / Live Demo Script

### Minute 0:00 – 0:45 | Introduction & Provider Onboarding
1. **Open [http://localhost:3000](http://localhost:3000):**
   - *"Welcome to TimeSync, an intelligent scheduling platform engineered to guarantee zero double-bookings via PostgreSQL exclusion constraints."*
2. **Sign in as Provider:**
   - Click **Sign In** $\rightarrow$ Click **Demo Provider** button (`provider@test.com`) $\rightarrow$ Click **Sign In**.
   - Show the **Provider Dashboard** (`/dashboard`): live metrics showing Upcoming, Completed, and Cancelled appointments.
3. **Configure Services & Hours:**
   - Navigate to **Manage Services** (`/dashboard/services`): showcase the 30-minute Consultation with a 10-minute buffer and price.
   - Navigate to **Hours & Time-Off** (`/dashboard/availability`): show the 7-day recurring weekly working hours (Mon–Fri 09:00 to 17:00) and the time-off blackout scheduler.

---

### Minute 0:45 – 1:45 | Customer Journey & Cross-Timezone Dynamic Slots
1. **Sign out & Sign in as Customer:**
   - Sign out $\rightarrow$ Click **Sign In** $\rightarrow$ Click **Demo Customer** button (`customer@test.com`).
2. **Browse Providers & Slot Generation:**
   - Click **Browse Providers** $\rightarrow$ Select **Dr. Sarah Jenkins**.
   - Note the **SlotPicker widget**:
     - Switch timezone from `UTC` to `America/New_York` or `Asia/Karachi`: slots dynamically recalculate in real time.
     - Observe the 40-minute slot step (30m service + 10m buffer = 10:00, 10:40, 11:20...).
3. **Confirm Booking:**
   - Click an available slot (e.g. `14:00`) $\rightarrow$ Modal opens showing provider name, duration, fee, and customer timezone.
   - Click **Confirm Booking**: booking is confirmed with automated `Idempotency-Key` and audit event.
   - Modal shows success badge $\rightarrow$ Click **View My Bookings**.

---

### Minute 1:45 – 2:45 | Real-Time Concurrency & The 409 Conflict Shield
1. **Explain the Concurrency Challenge:**
   - *"In high-traffic systems, race conditions allow two buyers to grab the same slot. Watch how TimeSync prevents this."*
2. **Run the 10-Thread Concurrency Benchmark:**
   - Switch to terminal:
     ```bash
     cd backend
     python scripts/test_concurrency.py
     ```
   - Show the live console output:
     - 10 parallel threads simultaneously fire `POST /api/bookings/` for the exact same slot.
     - **Result:** Thread 1 receives `HTTP 201 Created`. The other 9 threads receive `HTTP 409 Conflict`.
     - Database active rows = `1`.
3. **Show Frontend Conflict Shield:**
   - In browser, when a user clicks a slot that was just claimed, demonstrate the friendly dialog:
     *"Someone Just Booked This Slot! Our PostgreSQL exclusion lock prevented double-booking. The calendar has been refreshed with remaining openings."*

---

### Minute 2:45 – 3:45 | Atomic Reschedule, Cancellation Policy & Reminders
1. **Atomic Reschedule:**
   - In **My Bookings** (`/my-bookings`), find the confirmed appointment $\rightarrow$ Click **Reschedule**.
   - Pick a new date and open slot $\rightarrow$ Click **Confirm Reschedule**.
   - Point out: Reschedule count increments to `1`, audit event is logged, and reminders are automatically recalculated.
2. **Cancellation Policy Enforcement:**
   - Click **Cancel** on a booking.
   - Point out the policy warning: *"Cancellations made within 24 hours of start time are flagged as late cancellations according to provider policy."*
   - Confirm cancellation: slot is immediately released and pending reminder queue items are cancelled.
3. **Background Reminder Worker:**
   - Switch to terminal running:
     ```bash
     python manage.py run_reminders --once
     ```
   - Show the worker picking up due reminders with `SELECT FOR UPDATE SKIP LOCKED` and formatting mock email dispatches with exponential backoff on retry.

---

### Minute 3:45 – 4:30 | Technical Wrap-Up & Summary
- Conclude with the 3 pillars of TimeSync:
  1. **Zero Double-Bookings:** Native PostgreSQL `btree_gist` exclusion constraints.
  2. **Developer Experience & Security:** SimpleJWT authentication, object-level permissions, and 409 Conflict mitigation.
  3. **Cost Efficiency:** Over 80% monthly infrastructure savings using Cloud VPS over hyperscalers ($4.50/mo vs $28.50/mo).
