# Appointment & Scheduling SaaS — Work Plan (What To Do To Complete This Assignment)

Tick each box when done. Design first (especially the overlap prevention), then code.

## Phase 0 — Setup (≈1 hour)
- [ ] Create folder `Weekend2_YourName/02_Scheduling_SaaS/`
- [x] Create GitHub repo, `.gitignore`, `.env.example` (names only)
- [x] Stack: Django + Django REST Framework (DRF) + SimpleJWT + PostgreSQL + Next.js
- [x] Docker Compose for Postgres
- [ ] Commit in small meaningful steps

## Phase 1 — Requirements (≈1 hour) → part of `01_README.md`
- [ ] Roles: customer, provider (admin optional)
- [ ] Scope, out-of-scope, assumptions
- [ ] Acceptance criteria
- [ ] Journey: set up provider → customer books → reschedules → cancels
- [ ] Exceptions (slot taken, late cancellation, past date)

## Phase 2 — Design (≈3 hours)
- [ ] **Lucidchart architecture** → `02_architecture.pdf` + editable URL
- [ ] **Lucidchart ERD** → `03_database-design.pdf` + editable URL
- [x] `schema.sql` including `btree_gist` + `EXCLUDE` no-overlap constraint; run it successfully
- [ ] **Sequence diagrams:** success (slots → book → reminder) and failure (concurrent booking conflict 409, or reminder provider failure) → `04_api-workflows.pdf`
- [x] `openapi.yaml` or `api-spec.md`

## Phase 3 — Implementation (≈10–12 hours)
- [x] Auth + roles
- [x] Provider profile with IANA time zone
- [x] Services CRUD (duration, buffer)
- [x] Weekly working hours + time-off
- [x] **Slot generation** (provider time zone → UTC, DST-safe, minus bookings, min-notice)
- [x] Create booking (transaction + idempotency key + 409 on conflict)
- [x] Reschedule (single transaction, original kept if new slot fails)
- [x] Cancel with policy (free until N hours; otherwise `late_cancelled`)
- [x] Booking status transitions with validation
- [x] Booking events/audit trail
- [x] Reminders: create on confirm, replace on reschedule/cancel
- [x] Worker with `SKIP LOCKED`, backoff retry, duplicate-send protection
- [x] **Mock** reminder provider (clearly labelled in README/UI)
- [x] Frontend: provider setup, slot picker, my bookings, reschedule/cancel
- [x] Logging + `/health`

## Phase 4 — Security and reliability (≈2 hours)
- [x] Customer cannot access another customer's booking
- [x] Provider can only manage own data
- [x] Rate limit booking endpoint
- [x] Secrets only from env vars
- [x] Backup/restore note (try one real restore)
- [x] Job retry safety verified (kill worker mid-send, re-run → single reminder)

## Phase 5 — QA (≈3 hours) → `05_test-cases.xlsx`
Columns: Test ID, Feature, Preconditions, Steps, Input, Expected, Actual, Status, Defect ID, Evidence Link
- [x] Positive: full journey
- [x] Negative: past date, outside working hours, wrong service
- [x] Boundary: first/last slot, back-to-back bookings, midnight, DST days, min-notice edge
- [x] Authorization tests
- [x] **Concurrency test:** 10 parallel requests for one slot → exactly 1 succeeds (script + output as evidence)
- [x] Duplicate/retry: same idempotency key, reminder retries
- [x] Regression run after fixes; defect log with evidence
- [x] Execution proof (screenshots/logs)

## Phase 6 — Costs and scaling (≈2 hours) → `08_cost-and-scaling.xlsx`
- [x] Compare ≥2 hosts (VPS/Hostinger vs AWS): compute, DB, storage, backups, bandwidth, monitoring, queue, domain
- [x] Email/SMS provider cost per reminder (from real vendor pricing)
- [x] Scenarios for 100 / 1,000 / 10,000 / 1,000,000 users with assumptions (bookings/user/month, reminders/booking, peak factor)
- [x] **Every price: vendor URL + date accessed + region + currency. No invented numbers.**

## Phase 7 — Written deliverables (≈2 hours)
- [x] `01_README.md` (setup/run/test, implemented vs mocked, known gaps)
- [x] `06_engineering-decisions.md` (exclusion constraint vs locks, computed vs stored slots, time zone approach)
- [x] `09_sources-and-disclosure.md`
- [x] `07_source + demo`: repo link + **3–5 min demo** (booking, conflict, reschedule, cancel)

## Phase 8 — Submission
- [x] Put files 01–09 in `02_Scheduling_SaaS/`
- [x] Update parent `10_submission-index.md` (both projects, all links)
- [ ] Verify reviewer access to Drive/Lucidchart/video
- [ ] Share with HR + assigned Junior reviewer **before Monday**

## Phase 9 — AI Features & Intelligence Layer
- [x] **AI Concierge:** Natural language appointment search & 1-click slot booking (`/api/ai/concierge/`)
- [x] **AI Client Intake & Pre-Meeting Briefing:** Executive problem summary, 30-min agenda breakdown, and preparation checklist (`/api/ai/intake-brief/`)
- [x] **AI Smart Cancellation Recovery & Waitlist:** Real-time waitlist registration and instant notification matching when bookings are cancelled (`/api/ai/waitlist/`)
- [x] **AI Post-Meeting Action Items & Follow-up Generator:** Meeting summary, action item assignment with deadlines, and 1-click email dispatch (`/api/ai/meeting-followup/`)

## Monday interview prep — be ready to explain
- [x] How the `EXCLUDE` constraint works and why `[)` ranges
- [x] How slots are generated and how DST is handled
- [x] What happens when two users click the same slot
- [x] How reminders avoid duplicates after a crash
- [x] Cancellation policy logic
- [x] Cost at 10,000 users; bottlenecks
- [x] Fix a bug / small change live

## Final checklist
- [x] No secrets committed
- [x] Runs from clean clone using README only
- [x] Mocked parts labelled; nothing falsely claimed
- [x] All diagrams have editable URL + PDF