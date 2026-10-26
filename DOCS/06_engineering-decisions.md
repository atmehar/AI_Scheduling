# 06 - Key Architectural & Engineering Decisions

This document details the core architectural trade-offs, engineering rationales, and design decisions evaluated during the development of the **TimeSync AI Scheduling SaaS** platform.

---

## 1. Concurrency Control: PostgreSQL Exclusion Constraint vs. Application Locks vs. Distributed Locks

### The Problem
When two or more customers concurrently attempt to book the same appointment slot (or overlapping slots) for the same provider, traditional application-level validation suffers from **race conditions** (Time-of-Check to Time-of-Use / TOCTOU bugs).

### Evaluated Alternatives

| Approach | Mechanism | Advantages | Critical Vulnerabilities / Drawbacks | Verdict |
|:---|:---|:---|:---|:---:|
| **A. Application-Level Read-Check-Write** | `SELECT COUNT(*) ...` then `INSERT` | Simple to code, works across any database engine. | **Fatal Race Condition:** Two requests read zero bookings simultaneously, and both proceed to insert, causing double-bookings. | **REJECTED** |
| **B. Distributed Lock (Redis Redlock)** | Acquire lock on `key: provider_id:timestamp` before write | Fast in-memory acquisition, works across stateless horizontal web servers. | **Failure Modes & Complexity:** Clock drift between Redis nodes can breach safety; lock expiration mid-transaction leaves database exposed; does not natively handle range/overlap conflicts (e.g. 30m vs 60m overlapping service). | **REJECTED** |
| **C. Pessimistic Row Locking (`SELECT FOR UPDATE`)** | Lock provider row during write transaction | Native database ACID guarantees. | **Severe Bottleneck:** Serializes *all* bookings for a provider across all dates, destroying throughput even when customers book completely different days. | **REJECTED** |
| **D. PostgreSQL `btree_gist` Exclusion Constraint** | `EXCLUDE USING gist (provider_id WITH =, tstzrange(start_at, end_at, '[)') WITH &&) WHERE (status IN ('pending', 'confirmed'))` | **Mathematically Guaranteed Zero Overlaps:** Enforced directly in PostgreSQL storage engine via GiST index; handles arbitrary durations and overlapping intervals natively; non-overlapping bookings proceed concurrently without blocking. | Requires PostgreSQL with `btree_gist` extension; slight overhead on insert/update. | **ACCEPTED (CORE ARCHITECTURE)** |

### Why Half-Open Range `[)` Matters
A half-open interval `[start, end)` includes the exact starting millisecond but excludes the ending millisecond.
If Appointment A is `[10:00, 10:30)` and contiguous Appointment B is `[10:30, 11:00)`, their intersection is empty (`&&` operator returns `FALSE`).
Using a closed interval `[start, end]` would incorrectly reject valid back-to-back appointments because `10:30` would collide in both ranges.

---

## 2. Slot Generation: Computed On-The-Fly vs. Stored / Pre-Generated Database Rows

### The Problem
How should available booking slots be generated and presented to customers across multiple services, varying buffer times, and recurring working hours?

### Evaluated Alternatives

| Option | Pros | Cons | Verdict |
|:---|:---|:---|:---:|
| **Option A: Pre-Generated Slot Rows in DB** | Simple `SELECT * FROM slots WHERE is_booked=false`. | **Combinatorial Explosion & Stale State:** If a provider has 10 services with different durations (15m, 30m, 45m, 60m) and buffers, pre-generating slots requires generating millions of permutations. If the provider edits their Thursday hours or takes vacation, hundreds of rows must be updated or deleted. High write amplification and database bloat. | **REJECTED** |
| **Option B: Dynamic On-The-Fly Interval Math** | Zero storage overhead. Zero stale data. Always 100% accurate in real time. Changes to working hours, buffers, or time-off reflect instantaneously without any background sync jobs. | Requires CPU calculation per request. (Easily mitigated by 60s Redis caching for high traffic). | **ACCEPTED** |

### Implementation Math
Our `generate_available_slots` algorithm executes:
$$\text{Available Slots} = \text{Working Hours} \setminus (\text{Active Bookings} \cup \text{Buffer Windows} \cup \text{Time-Off Blackouts} \cup \text{Min Notice Delta})$$

---

## 3. Timezone Architecture: Strict UTC Storage vs. Localized DB Timestamps

### The Problem
Providers and customers frequently reside in different timezones (e.g., Doctor in `America/New_York`, Patient in `Asia/Karachi` or `Europe/London`). Furthermore, Daylight Saving Time (DST) shifts clocks backward or forward by 1 hour twice a year.

### The Decision: Universal UTC Persistence & Client-Side Localization
1. **Database Layer:** All database timestamps (`start_at`, `end_at`, `scheduled_for`, `cancelled_at`) are strictly stored as `TIMESTAMPTZ` normalized to UTC.
2. **Exclusion Range Math:** `tstzrange` operates strictly on absolute UTC points in time, making overlap checks immune to DST transitions, clock changes, or client timezone discrepancies.
3. **Slot Querying:** The client passes their timezone parameter (`?tz=Asia/Karachi`). The backend computes the provider's working hours in the provider's timezone, translates boundary times to UTC, subtracts conflicts, and formats the response with both absolute ISO 8601 UTC strings and localized display strings.

---

## 4. Background Notification Queue: PostgreSQL `SKIP LOCKED` vs. Celery / RabbitMQ

### The Problem
How to reliably dispatch 24h and 1h appointment reminders without dropped messages, duplicate notifications, or operational complexity?

### The Decision: In-Database Table Queue with `SELECT FOR UPDATE SKIP LOCKED`
- Rather than maintaining an external RabbitMQ or Redis message broker cluster with separate state stores, our system utilizes a dedicated `reminders` table in PostgreSQL.
- Using `select_for_update(skip_locked=True)`:
  - Concurrent worker processes or threads fetch non-overlapping batches of due reminders without blocking or waiting on each other.
  - Transactions maintain ACID atomicity: if a worker process crashes, uncommitted rows are automatically released back to the queue.
  - Reminders feature a `sent_at` timestamp guard preventing duplicate transmissions on worker retries.
- **Outcome:** Zero external infrastructure dependencies for MVP through 10,000 users, drastically lowering operational overhead while guaranteeing at-least-once delivery semantics.
