# 5-Component Handoff Report — Spec Miner 3

**From**: Spec Miner 3 (Requirements & API Spec Specialist)  
**To**: Orchestrator (Parent Agent)  
**Date**: 2026-08-17  
**Working Directory**: `k:\projects\tunetags\.agents\spec_miner_survey_3\`  
**Target Analysis File**: `k:\projects\tunetags\.agents\spec_miner_survey_3\analysis.md`

---

## 1. Observation

1. **Source Requirements**:
   - `k:\projects\tunetags\ORIGINAL_REQUEST.md` lines 15–32 specify five core requirement groups:
     - R1: Node.js + Express Backend & Database (SQLite/PostgreSQL tracking users, products, custom orders with Spotify link/code, custom text, preview parameters, and payments).
     - R2: Customer Authentication (Email+Password with bcrypt/argon2, Google OAuth 2.0, JWT tokens).
     - R3: Payment Gateway Integration (Razorpay for UPI, Cards, Netbanking; `/api/payments/create-order`, `/api/payments/verify`, webhooks).
     - R4: Customer Dashboard & Order Tracking (Order history, customization details, live status: Received, Engraving, Dispatched, Delivered).
     - R5: Developer Admin Portal & Instant Product Sync (`/admin`, Multer `/uploads`, prices, descriptions, stock toggle, order status updater, dynamic frontend sync via `/api/products`).

2. **Frontend Inspection**:
   - `k:\projects\tunetags\index.html` lines 1125–1179 contain static product cards for SPT-001 (Spotify Code Tag ₹699), RKY-001 (Rocky Keychain ₹300), and Drop 03 (Coming Soon).
   - Lines 1038, 1051, 1059, 1137, 1155, 1246, 1289 link to `https://www.instagram.com/tune.tagz/` instead of an integrated checkout flow.
   - Lines 1306–1567 handle hero carousel, card tilt, price counter, and drawer navigation in pure vanilla JS.

3. **Workspace State**:
   - Current directory contains no server file (`server.js`), no `package.json`, and no database yet.

---

## 2. Logic Chain

1. **Backend & Persistence Requirement (Observation 1)**:
   - TuneTagZ requires a lightweight, zero-configuration local database. SQLite (via `better-sqlite3` or `sqlite3`) provides single-file transactional storage for `users`, `products`, `orders`, `order_items`, `payments`, and `admin_audit_logs`.
   - The Express application must expose REST API routes under `/api/auth`, `/api/products`, `/api/orders`, `/api/payments`, `/api/admin`, and serve static files from `/uploads` and the project root.

2. **Authentication & Authorization (Observation 1, 2)**:
   - Email/password authentication requires `bcryptjs` hashing.
   - Google OAuth 2.0 requires token validation / account linking.
   - JWT tokens must encode `userId`, `email`, and `role` (`customer` vs `admin`) with cookie + Authorization header support.

3. **Catalog & Dynamic Sync (Observation 1, 2)**:
   - The admin portal needs `multer` to handle image uploads into `k:\projects\tunetags\uploads/`.
   - `index.html` must dynamically fetch `GET /api/products` and render catalog cards while falling back cleanly to static markup if the API is offline.

4. **Customizer & Order Lifecycle (Observation 1, 2)**:
   - Spotify custom keychains require validation of the Spotify track/album URL and a 30-character limit on custom engraved back text.
   - The order lifecycle must transition through a strict state machine: `PENDING_PAYMENT` -> `ORDER_RECEIVED` -> `ENGRAVING` -> `DISPATCHED` -> `DELIVERED` (or `CANCELLED` / `REFUNDED`).
   - Server-side price calculation must strictly enforce DB prices to prevent client-side price tampering.

5. **Payment Security & Verification (Observation 1)**:
   - Razorpay integration requires server-side order creation (`POST /api/payments/create-order`), cryptographic HMAC-SHA256 signature verification (`POST /api/payments/verify`), and webhook handling (`POST /api/payments/webhook`).
   - For offline test execution and automated CI, a deterministic mock payment mode (`MOCK_PAYMENTS=true`) must be supported.

---

## 3. Caveats

1. **Live Razorpay Credentials vs Mock Mode**:
   - In offline test environments without active Razorpay API keys, the test suite and local preview should use the deterministic mock payment provider to execute 100% of the payment and order confirmation flows.
2. **Google OAuth Client ID**:
   - Real Google Sign-In requires an active Google Cloud OAuth Client ID; for automated unit/integration tests, Google token verification can accept test ID tokens or mock decoding.

---

## 4. Conclusion

The specification and testable requirements for TuneTagZ are completely itemized and documented in `k:\projects\tunetags\.agents\spec_miner_survey_3\analysis.md`. The design comprises:
- 28 documented features across 7 categories (R1.1 to R7.5).
- Complete REST API schemas, request/response contracts, HTTP status codes, and error behaviors.
- Relational SQLite schema with 6 tables, foreign keys, and indexes.
- Deterministic 7-state Order Lifecycle state machine with valid/invalid transition guards.
- 3-tier Role-Based Access Control matrix (Public, Customer, Developer Admin).
- 4-Tier verification matrix (Unit, Boundary/Tamper, Integration, Resiliency).

---

## 5. Verification Method

To independently verify this specification:
1. Inspect the comprehensive analysis document at `k:\projects\tunetags\.agents\spec_miner_survey_3\analysis.md`.
2. Cross-reference the requirements against `k:\projects\tunetags\ORIGINAL_REQUEST.md` to confirm all 5 requirement pillars are covered.
3. Validate endpoint contracts and schemas against the test matrix in Section 8 of `analysis.md`.
