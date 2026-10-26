# API Specification Document (api-spec.md)
## Project: Appointment & Scheduling SaaS Platform
### Protocol: RESTful HTTPS + JSON | Auth: SimpleJWT Bearer Token

---

## 1. Global Conventions & Standard Error Format

- **Base URL:** `/api/`
- **Authentication Header:** `Authorization: Bearer <access_token>`
- **Idempotency Header:** `Idempotency-Key: <UUIDv4>` (required for `POST /api/bookings/`)
- **Content-Type:** `application/json`

### Standard Error Payloads

#### 400 Bad Request / Validation Error:
```json
{
  "field_name": [
    "This field is required."
  ]
}
```

#### 401 Unauthorized:
```json
{
  "detail": "Given token not valid for any token type",
  "code": "token_not_valid"
}
```

#### 403 Forbidden:
```json
{
  "detail": "You do not have permission to perform this action."
}
```

#### 409 Conflict (PostgreSQL Exclusion Constraint Violation):
```json
{
  "error": "slot_conflict",
  "detail": "This appointment slot has already been booked by another user. Please select an alternate slot."
}
```

---

## 2. Authentication & Identity (`apps.accounts`)

### 2.1 Register New User
- **Endpoint:** `POST /api/auth/register/`
- **Auth:** Public
- **Request Body:**
```json
{
  "email": "sarah@wellnessclinic.com",
  "password": "StrongPassword123!",
  "role": "provider",
  "first_name": "Sarah",
  "last_name": "Jenkins",
  "timezone": "America/New_York"
}
```
- **Response (201 Created):**
```json
{
  "id": 1,
  "email": "sarah@wellnessclinic.com",
  "role": "provider",
  "first_name": "Sarah",
  "last_name": "Jenkins",
  "timezone": "America/New_York",
  "tokens": {
    "access": "eyJhbGciOi...",
    "refresh": "eyJhbGciOi..."
  }
}
```

### 2.2 Obtain JWT Token Pair (Login)
- **Endpoint:** `POST /api/auth/token/`
- **Auth:** Public
- **Request Body:**
```json
{
  "email": "sarah@wellnessclinic.com",
  "password": "StrongPassword123!"
}
```
- **Response (200 OK):**
```json
{
  "access": "eyJhbGciOi...",
  "refresh": "eyJhbGciOi...",
  "user": {
    "id": 1,
    "email": "sarah@wellnessclinic.com",
    "role": "provider",
    "first_name": "Sarah",
    "last_name": "Jenkins",
    "timezone": "America/New_York"
  }
}
```

### 2.3 Refresh JWT Access Token
- **Endpoint:** `POST /api/auth/token/refresh/`
- **Auth:** Public
- **Request Body:**
```json
{
  "refresh": "eyJhbGciOi..."
}
```
- **Response (200 OK):**
```json
{
  "access": "eyJhbGciOi..."
}
```

### 2.4 Get Current User Profile
- **Endpoint:** `GET /api/auth/me/`
- **Auth:** `IsAuthenticated`
- **Response (200 OK):**
```json
{
  "id": 1,
  "email": "sarah@wellnessclinic.com",
  "role": "provider",
  "first_name": "Sarah",
  "last_name": "Jenkins",
  "timezone": "America/New_York"
}
```

---

## 3. Provider Settings & Catalog (`apps.providers`)

### 3.1 Get/Update Provider Profile
- **Endpoint:** `GET, PUT /api/providers/me/`
- **Auth:** `IsProvider`
- **Request Body (PUT):**
```json
{
  "display_name": "Dr. Sarah Wellness Clinic",
  "bio": "Specialized in holistic physical therapy.",
  "timezone": "America/New_York",
  "min_notice_minutes": 120,
  "cancellation_hours": 24
}
```

### 3.2 Services Management
- **Endpoints:**
  - `GET /api/providers/me/services/`: List provider's services
  - `POST /api/providers/me/services/`: Create service
  - `PUT, DELETE /api/providers/me/services/{id}/`: Update or soft-delete
- **Request Body (POST):**
```json
{
  "name": "General Physical Consultation",
  "duration_minutes": 30,
  "buffer_minutes": 10,
  "price_amount": "80.00",
  "currency": "USD"
}
```

### 3.3 Weekly Availability Schedule
- **Endpoint:** `GET, PUT /api/providers/me/working-hours/`
- **Auth:** `IsProvider`
- **Request Body (PUT - Bulk update):**
```json
[
  {"weekday": 0, "start_time": "09:00:00", "end_time": "17:00:00"},
  {"weekday": 1, "start_time": "09:00:00", "end_time": "17:00:00"},
  {"weekday": 2, "start_time": "09:00:00", "end_time": "17:00:00"},
  {"weekday": 3, "start_time": "09:00:00", "end_time": "17:00:00"},
  {"weekday": 4, "start_time": "09:00:00", "end_time": "15:00:00"}
]
```

### 3.4 Blackout Dates / Time-Off
- **Endpoints:**
  - `GET, POST /api/providers/me/time-off/`
  - `DELETE /api/providers/me/time-off/{id}/`
- **Request Body (POST):**
```json
{
  "start_at": "2026-11-20T00:00:00Z",
  "end_at": "2026-11-25T23:59:59Z",
  "reason": "National Physical Therapy Conference"
}
```

---

## 4. Scheduling & Booking Engine (`apps.scheduling`)

### 4.1 Dynamic Conflict-Free Slot Generation
- **Endpoint:** `GET /api/providers/{id}/slots/`
- **Auth:** Public
- **Query Parameters:**
  - `service_id` (required): Target service ID
  - `from` (required): ISO date `YYYY-MM-DD`
  - `to` (required): ISO date `YYYY-MM-DD`
  - `tz` (optional): Customer presentation timezone (defaults to provider timezone)
- **Response (200 OK):**
```json
{
  "provider_id": 1,
  "service_id": 1,
  "timezone": "America/New_York",
  "slots": [
    {
      "start_at": "2026-11-02T14:00:00Z",
      "end_at": "2026-11-02T14:30:00Z",
      "display_start": "2026-11-02 09:00",
      "display_end": "09:30"
    },
    {
      "start_at": "2026-11-02T14:40:00Z",
      "end_at": "2026-11-02T15:10:00Z",
      "display_start": "2026-11-02 09:40",
      "display_end": "10:10"
    }
  ]
}
```

### 4.2 Create Booking (Atomic & Idempotent)
- **Endpoint:** `POST /api/bookings/`
- **Auth:** `IsCustomer`
- **Headers:** `Idempotency-Key: <UUIDv4>`
- **Request Body:**
```json
{
  "provider_id": 1,
  "service_id": 1,
  "start_at": "2026-11-02T14:00:00Z"
}
```
- **Response (201 Created):**
```json
{
  "id": 101,
  "provider": {
    "id": 1,
    "display_name": "Dr. Sarah Wellness Clinic"
  },
  "service": {
    "id": 1,
    "name": "General Physical Consultation",
    "duration_minutes": 30
  },
  "start_at": "2026-11-02T14:00:00Z",
  "end_at": "2026-11-02T14:30:00Z",
  "status": "confirmed",
  "reschedule_count": 0
}
```
- **Error (409 Conflict):**
```json
{
  "error": "slot_conflict",
  "detail": "This appointment slot has already been booked by another user. Please select an alternate slot."
}
```

### 4.3 Atomic Reschedule Booking
- **Endpoint:** `PATCH /api/bookings/{id}/reschedule/`
- **Auth:** `IsBookingOwner`
- **Request Body:**
```json
{
  "new_start_at": "2026-11-03T15:00:00Z"
}
```
- **Response (200 OK):** Updated booking object.

### 4.4 Cancel Booking (Policy-Enforced)
- **Endpoint:** `POST /api/bookings/{id}/cancel/`
- **Auth:** `IsBookingOwner` or `IsProvider`
- **Response (200 OK):**
```json
{
  "id": 101,
  "status": "cancelled",
  "cancelled_at": "2026-10-24T21:50:00Z",
  "message": "Appointment cancelled within free cancellation window."
}
```

### 4.5 System Health
- **Endpoint:** `GET /api/health/`
- **Auth:** Public
- **Response (200 OK):**
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2026-10-24T21:55:00Z"
}
```
