-- ==============================================================================
-- Appointment & Scheduling SaaS Platform — Database Schema (schema.sql)
-- Target RDBMS: PostgreSQL 14+
-- Primary Invariant: Zero Double-Booking Guarantee via PostgreSQL Exclusion Constraints
-- ==============================================================================

-- 1. Enable btree_gist extension (required for scalar + range exclusion index)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 2. Clean teardown for idempotent testing (optional, commented out for safety)
-- DROP TABLE IF EXISTS reminders CASCADE;
-- DROP TABLE IF EXISTS booking_events CASCADE;
-- DROP TABLE IF EXISTS bookings CASCADE;
-- DROP TABLE IF EXISTS time_off CASCADE;
-- DROP TABLE IF EXISTS working_hours CASCADE;
-- DROP TABLE IF EXISTS services CASCADE;
-- DROP TABLE IF EXISTS providers CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;

-- 3. Users Table (Core identity & roles)
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('customer', 'provider', 'admin')),
    timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
    first_name VARCHAR(150) DEFAULT '',
    last_name VARCHAR(150) DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_staff BOOLEAN NOT NULL DEFAULT FALSE,
    is_superuser BOOLEAN NOT NULL DEFAULT FALSE,
    last_login TIMESTAMPTZ NULL,
    date_joined TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 4. Providers Table (Extended business settings)
CREATE TABLE IF NOT EXISTS providers (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    display_name VARCHAR(255) NOT NULL,
    bio TEXT DEFAULT '',
    timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
    min_notice_minutes INT NOT NULL DEFAULT 60 CHECK (min_notice_minutes >= 0),
    cancellation_hours INT NOT NULL DEFAULT 24 CHECK (cancellation_hours >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_providers_user_id ON providers(user_id);

-- 5. Services Table (Service catalog)
CREATE TABLE IF NOT EXISTS services (
    id BIGSERIAL PRIMARY KEY,
    provider_id BIGINT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    duration_minutes INT NOT NULL CHECK (duration_minutes > 0),
    buffer_minutes INT NOT NULL DEFAULT 0 CHECK (buffer_minutes >= 0),
    price_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (price_amount >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_services_provider_id ON services(provider_id);
CREATE INDEX IF NOT EXISTS idx_services_active ON services(provider_id, is_active);

-- 6. Working Hours Table (Weekly recurring availability in provider local time)
CREATE TABLE IF NOT EXISTS working_hours (
    id BIGSERIAL PRIMARY KEY,
    provider_id BIGINT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6), -- 0=Monday, 6=Sunday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_working_hours_end_gt_start CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_working_hours_provider_weekday ON working_hours(provider_id, weekday);

-- 7. Time-Off / Blackout Dates Table (Stored in UTC)
CREATE TABLE IF NOT EXISTS time_off (
    id BIGSERIAL PRIMARY KEY,
    provider_id BIGINT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    reason VARCHAR(255) DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_time_off_end_gt_start CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_time_off_provider_range ON time_off(provider_id, start_at, end_at);

-- 8. Bookings Table (The Core Invariant & Overlap Defense)
CREATE TABLE IF NOT EXISTS bookings (
    id BIGSERIAL PRIMARY KEY,
    provider_id BIGINT NOT NULL REFERENCES providers(id) ON DELETE RESTRICT,
    customer_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    service_id BIGINT NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'confirmed' 
        CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'late_cancelled', 'no_show')),
    cancelled_at TIMESTAMPTZ NULL,
    reschedule_count INT NOT NULL DEFAULT 0 CHECK (reschedule_count >= 0),
    idempotency_key UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_bookings_end_gt_start CHECK (end_at > start_at),
    -- ZERO DOUBLE-BOOKING INVARIANT:
    -- Prevents overlapping active bookings for the same provider using half-open [) intervals
    CONSTRAINT no_overlap_active_bookings
        EXCLUDE USING gist (
            provider_id WITH =,
            tstzrange(start_at, end_at, '[)') WITH &&
        ) WHERE (status IN ('pending', 'confirmed'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_customer_idempotency ON bookings(customer_id, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_bookings_provider_start ON bookings(provider_id, start_at);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_start ON bookings(customer_id, start_at);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

-- 9. Booking Events Table (Audit Trail)
CREATE TABLE IF NOT EXISTS booking_events (
    id BIGSERIAL PRIMARY KEY,
    booking_id BIGINT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- 'created', 'rescheduled', 'cancelled', 'completed'
    old_values JSONB NULL,
    new_values JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_events_booking_id ON booking_events(booking_id);

-- 10. Reminders Queue Table (Background Worker with SKIP LOCKED)
CREATE TABLE IF NOT EXISTS reminders (
    id BIGSERIAL PRIMARY KEY,
    booking_id BIGINT NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    channel VARCHAR(20) NOT NULL DEFAULT 'email' CHECK (channel IN ('email', 'sms')),
    scheduled_for TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
    attempts INT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    max_attempts INT NOT NULL DEFAULT 3,
    last_error TEXT NULL,
    sent_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_booking_channel_scheduled UNIQUE (booking_id, channel, scheduled_for)
);

CREATE INDEX IF NOT EXISTS idx_reminders_status_scheduled ON reminders(status, scheduled_for) 
    WHERE status = 'pending';
