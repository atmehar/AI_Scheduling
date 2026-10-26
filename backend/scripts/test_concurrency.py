import os
import sys
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import timedelta
from pathlib import Path
import django

# Setup Django standalone environment
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient
from apps.providers.models import Provider, Service, WorkingHour
from apps.scheduling.models import Booking

User = get_user_model()


def setup_concurrency_fixtures():
    """Create a dedicated provider, service, and 10 separate customers."""
    # 1. Provider
    provider_user, _ = User.objects.get_or_create(
        email="concurrency.provider@example.com",
        defaults={
            "role": "provider",
            "first_name": "Concurrency",
            "last_name": "Specialist",
            "timezone": "UTC"
        }
    )
    provider_user.set_password("StrongPass123!")
    provider_user.save()

    provider, _ = Provider.objects.get_or_create(
        user=provider_user,
        defaults={
            "display_name": "Concurrency Test Clinic",
            "min_notice_minutes": 10,
            "cancellation_hours": 24,
            "timezone": "UTC"
        }
    )

    # 2. Service
    service, _ = Service.objects.get_or_create(
        provider=provider,
        name="Concurrency Target Consultation",
        defaults={
            "duration_minutes": 30,
            "buffer_minutes": 10,
            "price_amount": "120.00",
            "currency": "USD",
            "is_active": True
        }
    )

    # 3. 10 unique customers
    customers = []
    for i in range(1, 11):
        user, _ = User.objects.get_or_create(
            email=f"concurrency.buyer.{i}@example.com",
            defaults={
                "role": "customer",
                "first_name": f"Buyer{i}",
                "last_name": "Test",
                "timezone": "UTC"
            }
        )
        user.set_password("StrongPass123!")
        user.save()
        customers.append(user)

    return provider, service, customers


def attempt_booking(customer, provider_id, service_id, target_slot_iso):
    """Worker function sending an authenticated POST /api/bookings/ request."""
    from django.db import connection
    connection.close()
    try:
        client = APIClient()
        client.force_authenticate(user=customer)
        idempotency_key = str(uuid.uuid4())

        response = client.post(
            "/api/bookings/",
            {
                "provider_id": provider_id,
                "service_id": service_id,
                "start_at": target_slot_iso,
                "timezone": "UTC"
            },
            format="json",
            HTTP_IDEMPOTENCY_KEY=idempotency_key
        )

        data = getattr(response, 'data', None)
        if data is None:
            try:
                data = response.content.decode('utf-8')
            except Exception:
                data = str(response.status_code)

        return {
            "customer_email": customer.email,
            "status_code": response.status_code,
            "response_data": data,
            "idempotency_key": idempotency_key
        }
    finally:
        connection.close()


def run_concurrency_benchmark(num_threads=10):
    provider, service, customers = setup_concurrency_fixtures()

    # Target slot: Exactly 7 days from now at 14:00 UTC
    target_date = (timezone.now() + timedelta(days=7)).replace(
        hour=14, minute=0, second=0, microsecond=0
    )
    target_slot_iso = target_date.isoformat()

    # Clear any previous test bookings at this slot
    Booking.objects.filter(
        provider=provider,
        start_at=target_date
    ).delete()

    print(f"======================================================================")
    print(f"STARTING CONCURRENCY COLLISION STRESS TEST")
    print(f"Provider:        {provider.display_name} (ID: {provider.id})")
    print(f"Service:         {service.name} (Duration: {service.duration_minutes}m)")
    print(f"Target Slot:     {target_slot_iso}")
    print(f"Parallel Buyers: {num_threads} simultaneous threads")
    print(f"======================================================================")

    results = []
    with ThreadPoolExecutor(max_workers=num_threads) as executor:
        futures = [
            executor.submit(
                attempt_booking,
                customers[i],
                provider.id,
                service.id,
                target_slot_iso
            )
            for i in range(num_threads)
        ]

        for future in as_completed(futures):
            res = future.result()
            results.append(res)
            print(f"Thread Finished -> Customer: {res['customer_email']} | HTTP Status: {res['status_code']}")

    successes = [r for r in results if r['status_code'] == 201]
    conflicts = [r for r in results if r['status_code'] == 409]
    others = [r for r in results if r['status_code'] not in (201, 409)]

    print(f"\n====================== CONCURRENCY TEST SUMMARY ======================")
    print(f"Total Parallel Requests: {len(results)}")
    print(f"Successful Bookings (201): {len(successes)}")
    print(f"Excluded Conflicts  (409): {len(conflicts)}")
    print(f"Other Errors:              {len(others)}")

    # Database verification
    db_count = Booking.objects.filter(
        provider=provider,
        start_at=target_date,
        status__in=['pending', 'confirmed']
    ).count()

    print(f"Database Active Bookings:  {db_count} (Must be EXACTLY 1)")
    print(f"Zero Double-Booking Check: {'PASSED' if db_count == 1 and len(successes) == 1 and len(conflicts) == 9 else 'FAILED'}")
    print(f"======================================================================\n")

    # Save evidence file
    evidence_path = BASE_DIR.parent / "DOCS" / "concurrency_test_evidence.txt"
    with open(evidence_path, "w", encoding="utf-8") as f:
        f.write("=== CONCURRENCY STRESS TEST EVIDENCE REPORT ===\n")
        f.write(f"Timestamp:                 {timezone.now().isoformat()}\n")
        f.write(f"Target Provider:           {provider.display_name} (ID: {provider.id})\n")
        f.write(f"Target Time:               {target_slot_iso}\n")
        f.write(f"Parallel Worker Threads:   {num_threads}\n")
        f.write(f"Successful Bookings (201): {len(successes)}\n")
        f.write(f"Protected Conflicts (409): {len(conflicts)}\n")
        f.write(f"Database Active Rows:      {db_count}\n\n")
        f.write("=== DETAILED THREAD RESPONSES ===\n")
        for idx, r in enumerate(results, start=1):
            f.write(f"Request #{idx:02d}: Customer={r['customer_email']} | HTTP {r['status_code']} | Detail={r['response_data']}\n")

    print(f"Evidence written to: {evidence_path}")
    return len(successes) == 1 and len(conflicts) == (num_threads - 1) and db_count == 1


if __name__ == '__main__':
    is_success = run_concurrency_benchmark(10)
    sys.exit(0 if is_success else 1)
