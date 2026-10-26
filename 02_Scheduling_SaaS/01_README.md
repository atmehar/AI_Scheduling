# TimeSync - Intelligent Appointment & Scheduling Platform

An enterprise-grade, multi-tenant scheduling platform built with **Django REST Framework (Python)**, **PostgreSQL (with `btree_gist` exclusion constraints)**, and **Next.js (React / pure JavaScript)**.

Guarantees **zero double-bookings** at the database engine level, performs cross-timezone slot generation, handles atomic reschedules, and automates notifications via concurrent worker queues.

---

## 1. System Architecture

```
                          +------------------------------------------+
                          |        Next.js Frontend (React / JS)     |
                          |  - Provider Dashboard & Slot Picker UI   |
                          |  - Real-time 409 Conflict Shield Alert   |
                          +------------------------------------------+
                                               |
                                     (HTTP / JSON REST)
                                               v
                          +------------------------------------------+
                          |       Django REST Framework Backend      |
                          |  - SimpleJWT Auth & Role Isolation       |
                          |  - Dynamic Slot Generator Engine         |
                          |  - Atomic BookingService Transaction     |
                          +------------------------------------------+
                                       |                 |
                   (Transactions & Exclusion)      (Poll & SKIP LOCKED)
                                       v                 v
          +------------------------------------+  +----------------------------+
          |     PostgreSQL 15+ (btree_gist)    |  |  Reminder Queue Worker     |
          |  - Table: bookings                 |  |  - select_for_update()     |
          |    EXCLUDE USING gist(...)         |  |    (skip_locked=True)      |
          |  - Table: reminders (Job Queue)    |  |  - Exponential Backoff     |
          +------------------------------------+  +----------------------------+
```

---

## 2. Key Features

- **Guaranteed Zero Double-Bookings:** Backed by PostgreSQL `btree_gist` half-open range exclusion constraints `[)` preventing overlapping slots under any concurrency level.
- **Real-Time 409 Conflict Handling:** If two users click the same slot simultaneously, exactly one succeeds and the other receives an instant `HTTP 409 Conflict`, prompting the UI to automatically refresh open slots.
- **Cross-Timezone Slot Engine:** Slots are computed dynamically on-the-fly and rendered in the customer's local timezone while stored strictly in UTC.
- **Atomic Rescheduling:** If rescheduling conflicts with another reservation, the transaction automatically rolls back, preserving the original booking intact.
- **Cancellation Policy Enforcement:** Cancellations within the provider's notice window (e.g. 24 hours) are tracked as `late_cancelled`.
- **Reliable Reminders Worker:** Concurrent background worker using `SELECT FOR UPDATE SKIP LOCKED` with automatic exponential backoff retry and duplicate-send prevention.

---

## 3. Technology Stack

- **Backend:** Python 3.12+, Django 5.x, Django REST Framework, SimpleJWT
- **Database:** PostgreSQL 15+ with `btree_gist` extension
- **Frontend:** Next.js (App Router, JavaScript / JSX), Tailwind CSS, Lucide React, Axios
- **Queue / Worker:** PostgreSQL `reminders` table queue + Django management command

---

## 4. Quick Start (Run from Clean Clone)

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm
- PostgreSQL 15+ running on port `5432` with database `AI_Scheduling_Meetings`

### A. Backend Setup
```bash
cd backend

# 1. Create and activate virtual environment
python -m venv venv
.\venv\Scripts\activate   # Windows
# source venv/bin/activate # Linux / macOS

# 2. Install dependencies
pip install -r requirements.txt
pip install openpyxl

# 3. Configure .env file
# (Copy from .env.example and set your DB_PASSWORD)
cp .env.example .env

# 4. Run database migrations (installs btree_gist extension and exclusion constraints)
python manage.py migrate

# 5. Start the backend API server
python manage.py runserver 8000
```
API will be live at `http://localhost:8000/api/`. Health check: `http://localhost:8000/api/health/`.

### B. Background Reminder Worker (Separate Terminal)
```bash
cd backend
.\venv\Scripts\activate
python manage.py run_reminders --poll-interval 5
```

### C. Frontend Setup
```bash
cd frontend

# 1. Install dependencies
npm install

# 2. Start Next.js development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 5. Automated Verification & Testing

### Run All Backend Unit Tests (44 Tests)
```bash
cd backend
.\venv\Scripts\activate
python manage.py test
```

### Run 10-Thread Concurrency Benchmark
```bash
cd backend
.\venv\Scripts\activate
python scripts/test_concurrency.py
```
*Result: 1 thread succeeds (201 Created), 9 threads receive 409 Conflict, exactly 1 row in DB.*

---

## 6. Implemented vs. Mocked Components

| Component | Status | Details |
|:---|:---:|:---|
| **Database Concurrency Control** | **Fully Implemented** | Native PostgreSQL `btree_gist` exclusion constraint `no_overlap_active_bookings`. |
| **Dynamic Slot Generator** | **Fully Implemented** | Real-time generator accounting for provider working hours, service duration, buffers, and time-off. |
| **Authentication & Authorization** | **Fully Implemented** | SimpleJWT with access/refresh rotation, object-level permissions, and scoped rate limits. |
| **Frontend Application** | **Fully Implemented** | Full Next.js React frontend (Dashboard, Service catalog, Availability, Slot Picker, My Bookings). |
| **Notification Dispatcher** | **MOCKED** | [`MockNotificationProvider`](file:///f:/Projects/Weekend%20Assesment%202/AI_Scheduling/backend/apps/notifications/services/mock_provider.py) logs email/SMS dispatches to stdout/logs and simulates network errors during tests without connecting to paid third-party gateways. |

---

## 7. Known Gaps & Future Enhancements

1. **Third-Party Payment Gateway:** Currently bookings transition directly to `confirmed`. Integration with Stripe Checkout / Webhooks can be added to require payment prior to slot locking.
2. **Calendar Sync (Google / Outlook CalDAV):** External two-way calendar sync would allow importing Google Calendar events as dynamic time-off blocks.
3. **Redis Caching Layer:** For 1,000,000+ users, adding Redis to cache `/api/providers/{id}/slots/` for 60 seconds will offload 90% of read traffic.
