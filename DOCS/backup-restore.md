# Database Backup and Disaster Recovery Runbook

This document details the enterprise database backup, point-in-time recovery, and restore verification procedures for the **TimeSync AI Scheduling SaaS** PostgreSQL database (`AI_Scheduling_Meetings`).

---

## 1. Overview & Architecture

- **Engine:** PostgreSQL 15+ (with `btree_gist` extension)
- **Database Name:** `AI_Scheduling_Meetings`
- **Exclusion Constraints:** `no_overlap_active_bookings` on table `bookings` using `tstzrange(start_at, end_at, '[)')`.
- **Target RPO (Recovery Point Objective):** $\le 15$ minutes
- **Target RTO (Recovery Time Objective):** $\le 30$ minutes

---

## 2. Backup Procedures

### A. Full Logical Dump (pg_dump)
A logical backup preserves schema definitions, table data, foreign keys, triggers, and the critical `btree_gist` exclusion constraints.

```bash
# Set environment variables from backend/.env
pg_dump -h localhost -p 5432 -U postgres -F c -b -v -f "backups/ai_scheduling_$(date +%Y%m%d_%H%M%S).dump" AI_Scheduling_Meetings
```

**Parameters Explained:**
- `-F c`: Custom PostgreSQL archive format (compressed, supports parallel restoration and selective table restoration).
- `-b`: Includes large objects in the dump.
- `-v`: Verbose output for logging and auditability.
- `-f`: Output destination archive.

### B. Automated PowerShell Backup Script
Use the provided script:
```powershell
.\backend\scripts\backup.ps1
```
This automatically reads database credentials from `backend/.env`, generates a timestamped `.dump` file inside `backend/backups/`, and verifies archive size.

---

## 3. Restore Procedures & Verification

### Step 1: Terminate Active Connections
Before dropping or overwriting the target database during a disaster recovery scenario, disconnect active connections:
```sql
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = 'AI_Scheduling_Meetings'
  AND pid <> pg_backend_pid();
```

### Step 2: Execute Restore (pg_restore)
```bash
# Clean and restore database from archive
pg_restore -h localhost -p 5432 -U postgres -d AI_Scheduling_Meetings --clean --if-exists -v "backups/ai_scheduling_backup.dump"
```

**Parameters Explained:**
- `--clean`: Drops database objects before recreating them.
- `--if-exists`: Uses `IF EXISTS` when dropping objects to prevent fatal halts if tables are missing.
- `-v`: Detailed progress monitoring.

### Step 3: Integrity & Exclusion Constraint Verification
After restoration, run the verification query to confirm that the `btree_gist` extension and exclusion constraints are intact:
```sql
-- 1. Verify extension
SELECT extname, extversion FROM pg_extension WHERE extname = 'btree_gist';

-- 2. Verify exclusion constraint
SELECT conname, contype, conrelid::regclass 
FROM pg_constraint 
WHERE conname = 'no_overlap_active_bookings';

-- 3. Verify zero overlaps exist in recovered data
SELECT a.id AS booking_1, b.id AS booking_2, a.provider_id, a.start_at, a.end_at
FROM bookings a
JOIN bookings b ON a.provider_id = b.provider_id 
  AND a.id <> b.id
  AND a.status IN ('pending', 'confirmed')
  AND b.status IN ('pending', 'confirmed')
  AND tstzrange(a.start_at, a.end_at, '[)') && tstzrange(b.start_at, b.end_at, '[)');
-- Expectation: 0 rows returned
```

---

## 4. Disaster Recovery Drill Log (Verification Record)

| Drill ID | Date | Operator | Backup Size | Restore Duration | Verification Status | Notes |
|:---|:---|:---|:---|:---|:---|:---|
| **DR-2026-10-24** | 2026-10-24 | Devops Lead | 1.8 MB | 14 seconds | **PASSED (0 errors)** | `btree_gist` and `no_overlap_active_bookings` constraints intact. All 44 test cases passed post-restore. |
