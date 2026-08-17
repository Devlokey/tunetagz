## 2026-08-17T14:04:22Z
You are the E2E Test Writer (teamwork_preview_test_writer) for TuneTagZ.
Your working directory is: k:\projects\tunetags\.agents\test_writer_1\
Original request path: k:\projects\tunetags\ORIGINAL_REQUEST.md
Project specification: k:\projects\tunetags\PROJECT.md
Test infrastructure spec: k:\projects\tunetags\TEST_INFRA.md
Project root: k:\projects\tunetags

YOUR TASK:
Design and build the comprehensive, requirement-driven, opaque-box E2E automated test suite in `k:\projects\tunetags\tests\`.

1. Read `ORIGINAL_REQUEST.md`, `PROJECT.md`, `TEST_INFRA.md`, and the survey analyses in `.agents/spec_miner_survey_3/analysis.md` and `.agents/explorer_survey_2/analysis.md`.
2. Build `tests/runner.js` — a standalone, zero-external-dependency (or using standard Node.js test/assert/http/fetch) test runner that:
   - Starts the backend server if not already running (or tests against `http://localhost:3000` / dynamic port).
   - Executes all test files across Tiers 1 to 4 sequentially.
   - Outputs a clean, colorized TAP / summary table showing passed/failed assertions per tier and feature.
   - Returns exit code 0 when all tests pass, exit code 1 if any fail.
3. Build the 4-tier test suites:
   - `tests/tier1_features/`: Test files covering all 28 features (F1 to F28) with at least 5 assertions per feature. Covers server health, SQLite DB tables, seed data, registration, login, Google auth, profile, admin login, product catalog, multer upload, dynamic catalog sync, Spotify URL/URI parsing, Spotify preview generator, custom order placement, server price calculation, Razorpay order creation, HMAC signature verification, webhooks, mock payments, customer order history, live order tracking API, order tracking stepper, admin stats, admin product CRUD, admin stock toggle, admin fulfillment pipeline, admin audit logs, and system integrity.
   - `tests/tier2_boundaries/`: Test files for boundary values, edge cases, tamper resistance (e.g. attempting to pay ₹1 for a ₹699 item, forged HMAC signatures, unauthenticated admin access, SQL injection payloads, invalid email formats, non-image file uploads, out-of-bounds custom text length >30 chars, invalid order state transitions).
   - `tests/tier3_combinations/`: Cross-feature pairwise workflow tests (Register -> Login -> Order -> Razorpay Pay -> Verify -> Track; Admin Login -> Multer Upload Image -> Add Product -> Verify in Public Catalog -> Toggle Stock; Customer Order -> Admin Updates Status to ENGRAVING -> Customer Tracking Reflects Status).
   - `tests/tier4_scenarios/`: Realistic application scenarios (Complete Customer E2E Journey, Developer Admin Store Management, Order Fulfillment Lifecycle, Security & Tamper Resistance, Concurrent Customer Orders & Inventory Integrity).
4. Create `k:\projects\tunetags\TEST_READY.md` at project root summarizing the test suite, execution command (`node tests/runner.js` or `npm test`), tier breakdown, and feature coverage checklist.
5. Write your handoff report to `k:\projects\tunetags\.agents\test_writer_1\handoff.md`.
Use `send_message` to notify the parent when complete.
