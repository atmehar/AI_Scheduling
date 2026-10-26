# 09 - Sources, Tools & Engineering Disclosure

This document discloses all libraries, external technologies, verified pricing data sources, and engineering standards utilized in the architecture, implementation, and testing of the **TimeSync Scheduling SaaS** project.

---

## 1. Open-Source Libraries & Frameworks

### Backend Technologies
| Package / Technology | Version | License | Primary Responsibility in Architecture |
|:---|:---:|:---:|:---|
| **Python** | 3.12+ | PSF | Runtime environment for backend services and automated test suites. |
| **Django** | 5.x | BSD-3-Clause | Core application framework, ORM, migrations, and database transactions. |
| **Django REST Framework** | 3.15+ | BSD-3-Clause | REST API serializers, viewsets, throttling, and exception handling. |
| **djangorestframework-simplejwt**| 5.3+ | MIT | JWT token generation, verification, and rotation. |
| **PostgreSQL & psycopg2-binary** | 15+ / 2.9+ | PostgreSQL / LGPL | Database engine, `btree_gist` extension, and half-open exclusion constraints. |
| **django-cors-headers** | 4.7+ | MIT | Cross-Origin Resource Sharing (CORS) integration for Next.js frontend. |
| **drf-spectacular** | 0.28+ | BSD-3-Clause | OpenAPI 3.0 schema generation and interactive Swagger UI documentation. |
| **python-dotenv** | 1.0+ | BSD-3-Clause | Secure loading of environment variables from `.env` files. |
| **openpyxl** | 3.1+ | MIT | Programmatic generation of styled Excel spreadsheets (`.xlsx`). |

### Frontend Technologies
| Package / Technology | Version | License | Primary Responsibility in Architecture |
|:---|:---:|:---:|:---|
| **Next.js** | 16.4.3 / 15+ | MIT | React framework (App Router, server/client components, pure JavaScript). |
| **React & React DOM** | 19.x | MIT | Core UI component lifecycle and DOM rendering. |
| **Tailwind CSS** | 4.x | MIT | Modern utility-first design system and responsive layout tokens. |
| **Lucide React** | 1.61+ | ISC | High-quality accessible vector icons. |
| **Axios** | 1.8+ | MIT | HTTP client with automatic Authorization headers and 401 refresh interceptors. |

---

## 2. Infrastructure & Real Pricing Sources

All pricing references utilized in [`08_cost-and-scaling.xlsx`](file:///f:/Projects/Weekend%20Assesment%202/AI_Scheduling/08_cost-and-scaling.xlsx) and [`DOCS/08_cost-and-scaling.md`](file:///f:/Projects/Weekend%20Assesment%202/AI_Scheduling/DOCS/08_cost-and-scaling.md) were retrieved and cross-verified in **October 2026** directly from official vendor documentation:

1. **Amazon Web Services (AWS) On-Demand Pricing:**
   - EC2 Compute: [https://aws.amazon.com/ec2/pricing/on-demand/](https://aws.amazon.com/ec2/pricing/on-demand/)
   - RDS for PostgreSQL: [https://aws.amazon.com/rds/postgresql/pricing/](https://aws.amazon.com/rds/postgresql/pricing/)
   - EBS gp3 Storage: [https://aws.amazon.com/ebs/pricing/](https://aws.amazon.com/ebs/pricing/)
   - S3 Standard Storage: [https://aws.amazon.com/s3/pricing/](https://aws.amazon.com/s3/pricing/)
   - Amazon SES Transactional Email: [https://aws.amazon.com/ses/pricing/](https://aws.amazon.com/ses/pricing/)
   - CloudFront CDN: [https://aws.amazon.com/cloudfront/pricing/](https://aws.amazon.com/cloudfront/pricing/)
   - Route 53 DNS: [https://aws.amazon.com/route53/pricing/](https://aws.amazon.com/route53/pricing/)
   - CloudWatch Monitoring: [https://aws.amazon.com/cloudwatch/pricing/](https://aws.amazon.com/cloudwatch/pricing/)

2. **Cloud VPS & Infrastructure Providers:**
   - Hetzner Cloud Instances (CPX series): [https://www.hetzner.com/cloud/](https://www.hetzner.com/cloud/)
   - Hetzner Dedicated Servers (AX series): [https://www.hetzner.com/dedicated-rootserver/](https://www.hetzner.com/dedicated-rootserver/)
   - Hetzner Storage Box: [https://www.hetzner.com/storage/storage-box/](https://www.hetzner.com/storage/storage-box/)
   - Hostinger KVM VPS: [https://www.hostinger.com/vps-hosting](https://www.hostinger.com/vps-hosting)

3. **Notification Gateways:**
   - Twilio Programmable SMS: [https://www.twilio.com/en-us/sms/pricing/us](https://www.twilio.com/en-us/sms/pricing/us)
   - Resend Transactional Email: [https://resend.com/pricing](https://resend.com/pricing)

---

## 3. Standards & Engineering Specifications

1. **IEEE 830-1998:** Recommended Practice for Software Requirements Specifications (SRS).
2. **PostgreSQL GiST Documentation:** Range Types & Indexing Principles ([PostgreSQL Official Docs](https://www.postgresql.org/docs/current/rangetypes.html)).
3. **RFC 7519:** JSON Web Token (JWT) Standard.
4. **RFC 3339 / ISO 8601:** Date and Time on the Internet: Timestamps.
5. **RFC 7231 / RFC 6585:** Hypertext Transfer Protocol (HTTP/1.1): Semantics and Content (HTTP 409 Conflict & HTTP 429 Too Many Requests).

---

## 4. Reused Code & Development Disclosure

- **Third-Party Code / External Code Generators:** Antigravity.
- **Implementation & Engineering Oversight:**
  - All database models, exclusion constraints, migrations, transactional semantics, error handling, and business logic were engineered and verified directly for this project.
  - Concurrency collision benchmark suites (`test_concurrency.py`), serializers, API viewsets, Next.js frontend pages/components, and spreadsheet models were developed in-house.
  - All 44 automated backend unit tests and 10 Next.js frontend routes were executed and validated with 0 errors against local PostgreSQL.

