# Handoff Report — Explorer Survey 2 (Backend & Architecture Specialist)

**Working Directory**: `k:\projects\tunetags\.agents\explorer_survey_2\`  
**Target Project Root**: `k:\projects\tunetags`  
**Date**: 2026-08-17  
**Parent Conversation ID**: `179f0250-175d-42bb-b9de-ec4d449da103`

---

## 1. Observation

- **Project Root Status**: Inspected `k:\projects\tunetags` via directory listing and found static frontend assets (`index.html`, `tunetagz (2).html`, `POSTER 1.png`, `POSTER 2.png`, `PRODUCT 1.png`, `PRODUCT 2.png`, `TUNETAGZ LOGO.png`, `manifest.json`, `robots.txt`, `sitemap.xml`). No `package.json` or backend server files existed yet.
- **Node & NPM Runtime**: Executed `node -v` and `npm -v` returning:
  - Node.js version: `v25.8.2`
  - NPM version: `11.11.1`
  - Platform/Arch: `win32 x64`
- **Frontend Product Contracts**: Inspected `index.html` lines 1125–1178:
  - Product 1: `SPT-001` ("Spotify Code Tag", ₹699, Bestseller, image `POSTER 1.png`)
  - Product 2: `RKY-001` ("Rocky Keychain", ₹300, New, image `POSTER 2.png`)
  - Product 3: `Drop 03` ("Coming Soon", Drop 03 — 2026)
  - Existing buttons currently link directly to Instagram (`https://www.instagram.com/tune.tagz/`).
- **User Requirements (ORIGINAL_REQUEST.md)**: Requires full Express backend, SQLite persistence, customer authentication (Email/Password with bcrypt/argon2 + Google OAuth 2.0), Razorpay payments (order creation, HMAC-SHA256 signature verification, webhooks), dynamic product catalog with Multer uploads, order tracking, and a developer-only admin portal.

---

## 2. Logic Chain

1. **Portable Embedded Database Decision**: Based on the requirement for zero-config portable execution on Windows, SQLite using `better-sqlite3` (with fallback to `sqlite3`) stores all tables (`users`, `products`, `orders`, `order_items`, `payments`, `admin_settings`) in `data/tunetagz.db` with WAL mode and foreign key constraints enabled.
2. **Pure JS Authentication**: Because Node v25 on Windows may not have build toolchains installed by default, using pure JavaScript `bcryptjs` for password hashing and `jsonwebtoken` for JWT issuance avoids any native C++ compilation failures while providing high security.
3. **Dual Google OAuth Strategy**: Google Sign-In with Google Identity Services (GIS) ID token verification via `google-auth-library` provides seamless 1-click customer login, backed by standard OAuth 2.0 code exchange callback.
4. **Secure Razorpay Architecture**: Server-side price calculation directly from the SQLite database prevents client-side price tampering. Verification uses constant-time `crypto.timingSafeEqual` over HMAC-SHA256 digests. A sandbox/mock mode is designed so development and test suites can pass even without live Razorpay API credentials.
5. **Multer File Storage**: Disk storage under `/uploads/` generates sanitized timestamped hashes, enforces MIME-type restrictions (JPEG/PNG/WEBP/SVG), enforces a 5MB limit, and exposes files via `app.use('/uploads', express.static(...))`.
6. **Developer Admin Portal**: Protected by `requireAdmin` middleware verifying the `role === 'admin' || role === 'developer'` claim, providing endpoints for sales metrics, order status advancement (`received` $\rightarrow$ `engraving` $\rightarrow$ `dispatched` $\rightarrow$ `delivered`), product CRUD with Multer image uploads, and store settings management.

---

## 3. Caveats

- **Razorpay API Keys**: Production Razorpay transactions require valid `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in `.env`. The architecture incorporates an automated mock mode fallback (`order_mock_...`) so development and automated tests run seamlessly offline.
- **Google OAuth Client ID**: Google Sign-In verification requires a valid `GOOGLE_CLIENT_ID` in `.env` for production; token validation logic gracefully handles mock tokens in test environments.
- **Single Instance SQLite**: SQLite in WAL mode handles thousands of read/write operations per second for a single server process. If multi-instance horizontal clustering is required in the future, SQLite can be replaced with PostgreSQL with minimal query changes.

---

## 4. Conclusion

The complete backend architecture, database schema, authentication flow, payment integration, file upload pipeline, and developer admin portal APIs have been fully designed and documented in `k:\projects\tunetags\.agents\explorer_survey_2\analysis.md`. The architecture is zero-config, highly portable, resilient on Windows/Node v25, and ready for immediate implementation by the downstream engineering agents.

---

## 5. Verification Method

To verify the investigation and architectural deliverables:
1. **Inspect Analysis Report**:
   ```bash
   view_file AbsolutePath="k:\projects\tunetags\.agents\explorer_survey_2\analysis.md"
   ```
2. **Verify Node & NPM Compatibility**:
   ```bash
   node -e "console.log(process.version, process.platform)"
   ```
3. **Validate Database Schema**:
   Review Section 4 of `analysis.md` for SQLite DDL statements, table relationships, foreign keys, indexes, and initial seed records.
4. **Validate API Endpoint Specifications**:
   Review Sections 5 through 9 of `analysis.md` for complete request/response contracts for `/api/auth`, `/api/products`, `/api/orders`, `/api/payments`, and `/api/admin`.
