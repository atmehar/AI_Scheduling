# TimeSync Frontend (Next.js & JavaScript)

Enterprise-grade appointment scheduling web application built with **Next.js (App Router)** in **pure JavaScript (React)**, styled with **Tailwind CSS**, and integrated with our Django REST Framework backend.

## Tech Stack
- **Framework:** Next.js (App Router, JavaScript / JSX)
- **Styling:** Tailwind CSS (Modern Glassmorphic UI & Color System)
- **Icons:** Lucide React
- **HTTP Client:** Axios with JWT auto-refresh interceptors
- **API Backend:** Django REST Framework (`http://localhost:8000/api`)

## Features Implemented
1. **Authentication & Roles:**
   - SimpleJWT authentication with access/refresh tokens in `localStorage`.
   - Silent 401 token refresh interceptor.
   - Role toggle during registration (`customer` vs `provider`).
   - Browser timezone auto-detection.

2. **Customer Journey:**
   - **Hero & Discovery:** Featured specialists, live search across providers and bio.
   - **Dynamic Slot Picker:** Real-time availability calculation, cross-timezone conversion, and half-open interval conflict safety.
   - **409 Conflict Shield:** When another user books a slot simultaneously, an alert dialog warns the user and instantly refreshes open slots.
   - **My Bookings:** View appointments, cancel with 24h policy warning, and dynamically reschedule slots.

3. **Provider Dashboard Suite:**
   - **Overview:** Active metrics (Upcoming, Completed, Cancelled, Total) and appointment management (Mark Complete, Cancel).
   - **Service Catalog CRUD:** Set name, duration (minutes), buffer time (minutes), price, currency, and active status.
   - **Weekly Recurring Hours:** 7-day schedule (Monday–Sunday) with toggleable start and end times.
   - **Time-Off Blackouts:** Define vacation or out-of-office date/time ranges that automatically block slot generation.

## Getting Started

### 1. Environment Configuration
Ensure `.env.local` contains:
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

### 2. Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

### 3. Production Build
```bash
npm run build
npm run start
```
