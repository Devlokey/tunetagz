# Project: TuneTagZ Full-Stack E-Commerce Platform

## Architecture & Code Layout
TuneTagZ is a high-performance, modular Node.js + Express backend with an embedded SQLite database, seamlessly integrated with a dynamic, responsive vanilla frontend.

### Code Layout
```
k:\projects\tunetags\
├── server.js                   # Application entry point & Express server bootstrap
├── package.json                # Dependencies, scripts (start, test, dev, seed)
├── .env.example                # Template for environment variables
├── .env                        # Local environment configuration
├── data/
│   └── tunetagz.db             # SQLite database file (WAL mode)
├── src/
│   ├── app.js                  # Express app setup, middleware, route mounting
│   ├── config/
│   │   ├── env.js              # Environment variable validation & defaults
│   │   └── database.js         # SQLite connection, initialization & schema migration
│   ├── middleware/
│   │   ├── auth.js             # JWT verification & customer authentication
│   │   ├── adminAuth.js        # Developer admin role verification
│   │   ├── upload.js           # Multer configuration for product image uploads
│   │   ├── errorHandler.js     # Centralized error handler
│   │   └── validator.js        # Request payload validation helper
│   ├── routes/
│   │   ├── auth.routes.js      # /api/auth endpoints
│   │   ├── product.routes.js   # /api/products endpoints
│   │   ├── order.routes.js     # /api/orders endpoints
│   │   ├── payment.routes.js   # /api/payments endpoints
│   │   ├── spotify.routes.js   # /api/spotify/preview endpoints
│   │   └── admin.routes.js     # /api/admin endpoints
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── product.controller.js
│   │   ├── order.controller.js
│   │   ├── payment.controller.js
│   │   └── admin.controller.js
│   ├── services/
│   │   ├── auth.service.js     # Password hashing, JWT signing, Google OAuth verify
│   │   ├── product.service.js  # Product queries, stock toggle, image handling
│   │   ├── order.service.js    # Order lifecycle state machine, price calculation
│   │   ├── payment.service.js  # Razorpay order creation, HMAC verification, webhooks
│   │   ├── admin.service.js    # Admin stats, order status advancement, audit logs
│   │   └── spotify.service.js  # Spotify link parsing & scannable code helper
│   └── utils/
│       ├── seed.js             # Initial product & admin seeder
│       └── logger.js           # Request & error logging utility
├── uploads/                    # Product images uploaded via Multer
├── tests/                      # Automated E2E 4-tier test suite (43 suites, 388 assertions)
│   ├── runner.js               # Opaque-box E2E test runner
│   ├── tier1_features/         # Tier 1 tests: feature coverage (>=5 per feature)
│   ├── tier2_boundaries/       # Tier 2 tests: boundary, edge cases, tamper resistance
│   ├── tier3_combinations/     # Tier 3 tests: pairwise cross-feature workflows
│   └── tier4_scenarios/        # Tier 4 tests: real-world end-to-end customer/admin workflows
├── public/                     # Static frontend assets
│   ├── index.html              # Main customer-facing storefront & dynamic catalog
│   ├── admin.html              # Developer Admin Portal
│   ├── manifest.json           # PWA manifest
│   ├── robots.txt & sitemap.xml
│   ├── js/
│   │   ├── api.js              # Centralized client-side fetch client
│   │   ├── auth.js             # Customer login/register & Google OAuth handler
│   │   ├── customizer.js       # Spotify soundwave & engraving live preview
│   │   ├── checkout.js         # Razorpay checkout modal integration
│   │   ├── tracking.js         # Live order tracking stepper
│   │   └── admin.js            # Admin portal dashboard, product uploads, fulfillment
│   ├── css/
│   │   ├── customizer.css      # Customizer modal & card styling
│   │   └── admin.css           # Admin portal dashboard styling
│   └── images/                 # Static brand assets (PRODUCT 1, PRODUCT 2, LOGO, POSTERS)
```

---

## Feature Inventory

| # | Feature | Description | Milestone | Status |
|---|---------|-------------|-----------|--------|
| F1 | Express Server Bootstrap | Express app with CORS, JSON body parser, URL-encoded parser, static file serving (`/uploads`, `/`). | M1 | DONE |
| F2 | SQLite Database & Migrations | SQLite storage (`data/tunetagz.db`) in WAL mode with tables for `users`, `products`, `orders`, `order_items`, `payments`, `admin_audit_logs`. | M1 | DONE |
| F3 | Initial Data Seeding | Seed initial products (Spotify Code Tag ₹699, Rocky Keychain ₹300) and default admin account. | M1 | DONE |
| F4 | Customer Email/Password Registration | `POST /api/auth/register` with email validation, bcrypt password hashing, duplicate check. | M2 | DONE |
| F5 | Customer Email/Password Login | `POST /api/auth/login` returning JWT token & user profile. | M2 | DONE |
| F6 | Google OAuth 2.0 Authentication | `POST /api/auth/google` verifying Google ID token / code and issuing JWT. | M2 | DONE |
| F7 | Customer Session & Profile | `GET /api/auth/me` to retrieve current authenticated user. | M2 | DONE |
| F8 | Developer Admin Login | `POST /api/auth/admin/login` validating admin credentials and returning admin-scoped JWT. | M2 | DONE |
| F9 | Public Product Catalog API | `GET /api/products` (list active products) and `GET /api/products/:id` (single product details). | M3 | DONE |
| F10 | Multer Product Image Upload Pipeline | `POST /api/products/upload` handling single/multiple image uploads to `/uploads/` with MIME validation. | M3 | DONE |
| F11 | Dynamic Storefront Catalog Sync | `index.html` dynamically fetches `/api/products` and renders catalog cards with fallback. | M3 | DONE |
| F12 | Spotify Link & URI Parsing | Parsing track/album/artist Spotify URLs and URIs to extract Spotify IDs. | M4 | DONE |
| F13 | Interactive Spotify Customizer | 2-sided preview modal (front: Spotify soundwave code; back: custom engraved text up to 30 chars). | M4 | DONE |
| F14 | Order Placement with Customization | `POST /api/orders` creating orders with customization parameters (Spotify code, song name, custom text). | M4 | DONE |
| F15 | Server-Side Price Calculation | Strictly enforcing DB product prices to prevent client-side price tampering. | M4 | DONE |
| F16 | Razorpay Order Creation | `POST /api/payments/create-order` creating Razorpay orders in INR paise with receipt ID. | M4 | DONE |
| F17 | Cryptographic Payment Verification | `POST /api/payments/verify` verifying HMAC-SHA256 signature using `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`. | M4 | DONE |
| F18 | Payment Webhook Handler | `POST /api/payments/webhook` handling async payment capture / refund events with signature check. | M4 | DONE |
| F19 | Mock Payment Provider for CI/Offline | Deterministic sandbox payment mode (`MOCK_PAYMENTS=true`) for automated tests without API keys. | M4 | DONE |
| F20 | Customer Order History | `GET /api/orders/my-orders` returning all orders for authenticated customer with customizer details. | M5 | DONE |
| F21 | Live Order Tracking API | `GET /api/orders/:orderId/track` returning public/authenticated order status and tracking milestones. | M5 | DONE |
| F22 | Visual Order Tracking UI | 5-step interactive progress timeline (`ORDER_RECEIVED` -> `ENGRAVING` -> `QUALITY_CHECK` -> `DISPATCHED` -> `DELIVERED`). | M5 | DONE |
| F23 | Admin Dashboard & KPI Stats | `GET /api/admin/stats` returning total sales, revenue, pending orders, product counts. | M6 | DONE |
| F24 | Admin Product Management (CRUD) | `POST /api/admin/products`, `PUT /api/admin/products/:id`, `DELETE /api/admin/products/:id` with image upload. | M6 | DONE |
| F25 | Admin Stock Availability Toggle | `PATCH /api/admin/products/:id/stock` toggling in-stock/out-of-stock. | M6 | DONE |
| F26 | Admin Order Fulfillment Pipeline | `PATCH /api/admin/orders/:id/status` advancing order states (`ORDER_RECEIVED` -> `ENGRAVING` -> `DISPATCHED` -> `DELIVERED`). | M6 | DONE |
| F27 | Admin Audit Logging | Recording admin changes to orders, products, and prices in `admin_audit_logs`. | M6 | DONE |
| F28 | 100% E2E Test Suite & Adversarial Hardening | Requirement-driven automated E2E test suite (Tiers 1-4) + Tier 5 white-box adversarial verification. | M_FINAL | DONE |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| E2E_TRACK | E2E Testing Suite Track | Independent test infra, test runner, Tiers 1-4 test suite derived from ORIGINAL_REQUEST.md | none | DONE |
| M1 | Backend Core & Database | Express bootstrap, SQLite database schema, migrations, seeders, config | none | DONE |
| M2 | Customer & Admin Authentication | Email/password auth, Google OAuth 2.0, JWT tokens, auth/admin middlewares | M1 | DONE |
| M3 | Product Management & Frontend Sync | Product REST API, Multer upload pipeline, dynamic catalog sync in `index.html` | M1 | DONE |
| M4 | Customizer & Razorpay Payments | Customizer engine, order creation, Razorpay order/verify/webhook APIs + mock mode | M1, M2, M3 | DONE |
| M5 | Customer Dashboard & Live Tracking | Customer order history, tracking API, frontend 5-step tracking stepper | M4 | DONE |
| M6 | Developer Admin Portal | Admin dashboard UI, product CRUD, image upload, order fulfillment status updater | M1, M2, M3, M4 | DONE |
| M_FINAL | 100% E2E Pass & Adversarial Hardening | Pass 100% E2E test suite (Tiers 1-4) + Tier 5 adversarial stress testing | M1-M6, E2E_TRACK | DONE |
