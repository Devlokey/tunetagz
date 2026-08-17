# E2E Test Infra: TuneTagZ Full-Stack Platform

## Test Philosophy
- Opaque-box, requirement-driven. No dependency on implementation design.
- Direct verification of HTTP REST API endpoints, static assets, dynamic frontend scripts, security policies, and payment workflows.
- Methodology: Category-Partition + Boundary Value Analysis (BVA) + Pairwise Combinatorial Testing + Real-World Workload Testing.

## Feature Inventory
| # | Feature | Source | Tier 1 | Tier 2 | Tier 3 |
|---|---------|--------|:------:|:------:|:------:|
| F1 | Express Server Bootstrap & Health | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| F2 | SQLite Database & Migrations | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| F3 | Initial Seed Data | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| F4 | Customer Registration | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| F5 | Customer Login | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| F6 | Google OAuth 2.0 Auth | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| F7 | Customer Session / Profile | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| F8 | Developer Admin Login | ORIGINAL_REQUEST §R5 | 5 | 5 | ✓ |
| F9 | Public Product Catalog API | ORIGINAL_REQUEST §R1, R5 | 5 | 5 | ✓ |
| F10 | Multer Image Upload | ORIGINAL_REQUEST §R5 | 5 | 5 | ✓ |
| F11 | Frontend Dynamic Catalog Sync | ORIGINAL_REQUEST §R5 | 5 | 5 | ✓ |
| F12 | Spotify URL/URI Parser | ORIGINAL_REQUEST §R1, R4 | 5 | 5 | ✓ |
| F13 | Spotify Customizer Preview | ORIGINAL_REQUEST §R1, R4 | 5 | 5 | ✓ |
| F14 | Custom Order Placement | ORIGINAL_REQUEST §R1, R4 | 5 | 5 | ✓ |
| F15 | Server-Side Price Calculation | ORIGINAL_REQUEST §R1, R3 | 5 | 5 | ✓ |
| F16 | Razorpay Order Creation | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| F17 | Cryptographic HMAC Verification | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| F18 | Payment Webhooks | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| F19 | Sandbox / Mock Payments | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| F20 | Customer Order History | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ |
| F21 | Live Order Tracking API | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ |
| F22 | Visual Order Tracking Stepper | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ |
| F23 | Admin Dashboard & Stats | ORIGINAL_REQUEST §R5 | 5 | 5 | ✓ |
| F24 | Admin Product CRUD | ORIGINAL_REQUEST §R5 | 5 | 5 | ✓ |
| F25 | Admin Stock Availability | ORIGINAL_REQUEST §R5 | 5 | 5 | ✓ |
| F26 | Admin Order Fulfillment | ORIGINAL_REQUEST §R5 | 5 | 5 | ✓ |
| F27 | Admin Audit Logs | ORIGINAL_REQUEST §R5 | 5 | 5 | ✓ |
| F28 | End-to-End System Integrity | ORIGINAL_REQUEST §All | 5 | 5 | ✓ |

## Test Architecture
- **Test runner**: `node tests/runner.js`
- **Output format**: TAP / Colorized test matrix report with tier breakdowns and pass/fail summary. Exit code 0 on 100% pass, non-zero on failure.
- **Directory Layout**:
  - `tests/runner.js`: Test runner executing all tier test suites.
  - `tests/tier1_features/`: Feature tests (T1.1 through T1.28).
  - `tests/tier2_boundaries/`: Boundary, security, and tamper resistance tests.
  - `tests/tier3_combinations/`: Pairwise integration scenarios (Auth + Orders, Product Upload + Frontend Sync, Razorpay + Order Status).
  - `tests/tier4_scenarios/`: Real-world end-to-end customer and developer workflows.

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Complete Customer Journey (Register -> Customize Spotify Tag -> Razorpay Mock Payment -> Live Tracking) | F4, F5, F12, F13, F14, F15, F16, F17, F20, F21, F22 | High |
| 2 | Developer Admin Store Management (Admin Login -> Multer Upload Image -> Add Product -> Frontend Dynamic Sync -> Toggle Stock) | F8, F10, F11, F23, F24, F25, F27 | High |
| 3 | Order Fulfillment Lifecycle (Customer Order -> Admin Advances Status: Received -> Engraving -> Dispatched -> Delivered -> Customer Tracking Reflects Live) | F14, F16, F17, F21, F22, F26, F27 | High |
| 4 | Security & Tamper Resistance (Price Manipulation Attempt -> Invalid Signature Attempt -> Unauthenticated Admin Access -> Malicious File Upload) | F8, F10, F15, F17, F24 | High |
| 5 | Concurrent Customer Orders & Inventory Integrity (Multiple customers purchasing simultaneously, tracking unique order numbers and payment receipts) | F2, F14, F16, F17, F20, F21 | High |

## Coverage Thresholds
- Tier 1: >=5 test cases per feature (28 features)
- Tier 2: >=5 boundary/tamper test cases per feature
- Tier 3: Pairwise coverage across auth, payment, ordering, product sync, and fulfillment
- Tier 4: >=5 realistic end-to-end workload scenarios
