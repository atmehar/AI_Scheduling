# 10 - Submission Index & Deliverables Manifest

**Project Title:** TimeSync - Multi-Tenant Appointment & Scheduling Platform with Guaranteed Zero Double-Bookings  
**Candidate / Author:** Full-Stack AI Engineer  
**Submission Date:** October 2026  
**Primary Tech Stack:** Python (Django 5.x + Django REST Framework) | PostgreSQL 15+ (`btree_gist`) | Next.js (React / pure JavaScript) | Tailwind CSS

---

## Deliverables Package Manifest (`02_Scheduling_SaaS/`)

| File | Title | Description | Link |
|:---|:---|:---|:---|
| **01** | `01_README.md` | Primary setup, clean clone running guide, implemented vs mocked components, and architecture overview. | [`01_README.md`](file:///f:/Projects/Weekend%20Assesment%202/AI_Scheduling/02_Scheduling_SaaS/01_README.md) |
| **02** | `02_PRD.md` | Product Requirements Document: Personas, User Journeys, Functional & Non-Functional Requirements, Success Metrics. | [`02_PRD.md`](file:///f:/Projects/Weekend%20Assesment%202/AI_Scheduling/02_Scheduling_SaaS/02_PRD.md) |
| **03** | `03_SRS.md` | IEEE 830 System Requirements Specification: Mathematical slot equations, DB schema, API contract, Concurrency proof. | [`03_SRS.md`](file:///f:/Projects/Weekend%20Assesment%202/AI_Scheduling/02_Scheduling_SaaS/03_SRS.md) |
| **04** | `04_architecture.md` | System Decomposition: Modular structure (BE-01 through BE-05, FE-01 through FE-04). | [`04_architecture.md`](file:///f:/Projects/Weekend%20Assesment%202/AI_Scheduling/02_Scheduling_SaaS/04_architecture.md) |
| **05** | `05_test-cases.xlsx` | 20 Automated QA Test Cases: Positive, Negative, Boundary, Security, Concurrency, and Reliability matrix. | [`05_test-cases.xlsx`](file:///f:/Projects/Weekend%20Assesment%202/AI_Scheduling/02_Scheduling_SaaS/05_test-cases.xlsx) |
| **06** | `06_engineering-decisions.md` | Core Architectural Trade-offs: Exclusion constraints vs Locks, Computed vs Stored slots, UTC vs Local timezones. | [`06_engineering-decisions.md`](file:///f:/Projects/Weekend%20Assesment%202/AI_Scheduling/02_Scheduling_SaaS/06_engineering-decisions.md) |
| **07** | `07_source_and_demo.md` | Codebase directory navigation and step-by-step 3–5 minute live demo presentation walkthrough script. | [`07_source_and_demo.md`](file:///f:/Projects/Weekend%20Assesment%202/AI_Scheduling/02_Scheduling_SaaS/07_source_and_demo.md) |
| **08** | `08_cost-and-scaling.xlsx` | Infrastructure cost comparison (AWS vs Hetzner/Hostinger VPS) across 100, 1K, 10K, and 1M user scale models. | [`08_cost-and-scaling.xlsx`](file:///f:/Projects/Weekend%20Assesment%202/AI_Scheduling/02_Scheduling_SaaS/08_cost-and-scaling.xlsx) |
| **09** | `09_sources-and-disclosure.md` | Open-source libraries, standards citations, verified live vendor pricing URLs, and engineering disclosure (zero external code reuse). | [`09_sources-and-disclosure.md`](file:///f:/Projects/Weekend%20Assesment%202/AI_Scheduling/02_Scheduling_SaaS/09_sources-and-disclosure.md) |

---

## Monday Interview Defense Quick Reference

1. **How the `EXCLUDE` constraint works and why `[)` ranges:**
   - Enforced by PostgreSQL storage engine via GiST index on `(provider_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&) WHERE status IN ('pending', 'confirmed')`.
   - Half-open range `[start, end)` includes start but excludes end, enabling seamless back-to-back appointments (e.g. 10:00–10:30 and 10:30–11:00) without collision.
2. **How slots are generated and DST is handled:**
   - Interval subtraction: Provider Working Hours minus Active Bookings minus Buffers minus Time-Off minus Notice Delta.
   - All persistence is strict UTC (`TIMESTAMPTZ`); DST shifts in client timezones (e.g. America/New_York Fall-back) produce smooth continuous slots without gaps or crashes.
3. **What happens when two users click the same slot:**
   - Exactly one transaction commits. The other raises an exclusion constraint violation (`IntegrityError`).
   - Caught by `custom_exception_handler` and returned as `HTTP 409 Conflict` (`slot_conflict`).
   - Frontend displays friendly modal ("Someone Just Booked This Slot!") and immediately refreshes open slots.
4. **How reminders avoid duplicates after a crash:**
   - Worker queries `status='pending'` using `SELECT FOR UPDATE SKIP LOCKED`.
   - On crash before commit, uncommitted transaction rolls back without duplicate send.
   - On simulated failure, exponential backoff is scheduled; on retry delivery, `sent_at` timestamp guard prevents duplicate dispatches.
5. **Cost at 10,000 users and bottlenecks:**
   - $42.50/mo on Modern Cloud VPS vs $189.44/mo on AWS (77% savings).
   - Bottlenecks: `btree_gist` RAM requirements (solved by filtering active bookings only), connection pool exhaustion (solved by PgBouncer), slot calculation CPU (solved by 60s Redis caching).
