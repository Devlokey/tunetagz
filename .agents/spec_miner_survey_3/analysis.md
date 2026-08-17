# TuneTagZ — Comprehensive Specification & API Requirements Analysis

**Author**: Spec Miner 3 (Requirements & API Spec Specialist)  
**Date**: 2026-08-17  
**Status**: Authoritative Reference Specification  
**Project Workspace**: `k:\projects\tunetags`  
**Authoritative Request**: `k:\projects\tunetags\ORIGINAL_REQUEST.md`

---

## 1. Executive Summary & Architectural Scope

TuneTagZ is an e-commerce platform specializing in custom-engraved Spotify code keychains and wearable sculpture merchandise. The goal of this engineering initiative is to implement a robust, production-ready Node.js + Express backend server with zero-config database storage (SQLite), customer authentication (Email/Password + Google OAuth 2.0), Razorpay payment gateway integration with HMAC-SHA256 signature verification and webhook idempotency, customer order tracking dashboard, dynamic frontend catalog synchronization, and a developer-only administrative portal.

---

## 2. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | R1: Backend & DB | Server Bootstrap & Health Check | Express server listening on configurable port (default 3000/5000), health diagnostic endpoint | HTTP GET `/api/health` | 200 OK `{ status: "ok", timestamp, uptime, db: "connected" }` | 500 on DB connection failure | ORIGINAL_REQUEST.md R1 |
| 2 | R1: Backend & DB | Database Schema & Migrations | SQLite database initialization with tables for users, products, orders, order_items, payments, audit logs | Startup SQL migration script | SQLite DB file `tunetagz.db`, structured schema | Fatal crash on invalid SQL / disk permission error | ORIGINAL_REQUEST.md R1 |
| 3 | R1: Backend & DB | Static & Upload Asset Pipeline | Static file serving for frontend HTML/CSS/JS and `/uploads` directory for product images | HTTP GET `/uploads/:filename`, GET `/*` | Static file streams (PNG, JPG, HTML, CSS, JS) | 404 Not Found for missing static assets | ORIGINAL_REQUEST.md R1, R5 |
| 4 | R2: Auth | Customer Registration | Register new customer with email, full name, phone number, and password (hashed with bcrypt/argon2) | `POST /api/auth/register` `{ email, password, name, phone }` | 201 Created `{ user: { id, email, name, role }, token }` | 400 Validation Error, 409 Email Conflict | ORIGINAL_REQUEST.md R2 |
| 5 | R2: Auth | Customer & Admin Login | Authenticate customer or admin via email & password, returning JWT and setting HttpOnly cookie | `POST /api/auth/login` `{ email, password }` | 200 OK `{ user: { id, email, name, role }, token }` | 401 Invalid Credentials, 400 Missing Fields | ORIGINAL_REQUEST.md R2 |
| 6 | R2: Auth | Google OAuth 2.0 Authentication | Google Sign-In via ID Token verification or OAuth redirect flow | `POST /api/auth/google` `{ idToken }` or OAuth callback | 200 OK `{ user: { id, email, name, role, avatar }, token }` | 401 Invalid Google Token, 400 Missing Token | ORIGINAL_REQUEST.md R2 |
| 7 | R2: Auth | Session / Profile Introspection | Retrieve authenticated user profile and permissions | `GET /api/auth/me` with Bearer token / Cookie | 200 OK `{ user: { id, email, name, phone, role, createdAt } }` | 401 Unauthorized | ORIGINAL_REQUEST.md R2 |
| 8 | R2: Auth | Customer & Admin Logout | Clear session cookie and invalidate client token | `POST /api/auth/logout` | 200 OK `{ message: "Logged out successfully" }` | 200 OK idempotent | ORIGINAL_REQUEST.md R2 |
| 9 | R3: Catalog | Public Product Catalog Listing | Fetch all active merchandise items for dynamic frontend rendering | `GET /api/products` (optional query: `?inStock=true`) | 200 OK `[ { id, sku, name, description, price, imageUrl, badge, inStock, comingSoon, createdAt } ]` | 500 Internal DB Error | ORIGINAL_REQUEST.md R5 |
| 10 | R3: Catalog | Public Product Detail by ID/SKU | Retrieve single product details | `GET /api/products/:id` | 200 OK `{ id, sku, name, description, price, imageUrl, ... }` | 404 Product Not Found | ORIGINAL_REQUEST.md R5 |
| 11 | R3: Catalog | Admin Product Creation | Create new product with image upload via `multer` | `POST /api/products` (multipart/form-data: `file`, `name`, `sku`, `price`, `description`, `badge`, `inStock`, `comingSoon`) | 201 Created `{ product: { id, sku, name, price, imageUrl, ... } }` | 401/403 Unauthorized, 400 Bad Request, 415 Invalid File Type | ORIGINAL_REQUEST.md R5 |
| 12 | R3: Catalog | Admin Product Update | Update existing product details, price, descriptions, or replace image | `PUT /api/products/:id` (multipart/form-data or JSON) | 200 OK `{ product: { id, sku, name, price, ... } }` | 401/403 Unauthorized, 404 Not Found, 400 Invalid Input | ORIGINAL_REQUEST.md R5 |
| 13 | R3: Catalog | Admin Product Deletion | Delete or soft-delete product from catalog | `DELETE /api/products/:id` | 200 OK `{ message: "Product deleted" }` | 401/403 Unauthorized, 404 Not Found | ORIGINAL_REQUEST.md R5 |
| 14 | R3: Catalog | Admin Toggle Stock Availability | Toggle stock status (`inStock: boolean`) for instant store update | `PATCH /api/products/:id/stock` `{ inStock: boolean }` | 200 OK `{ id, inStock }` | 401/403 Unauthorized, 404 Not Found, 400 Bad Request | ORIGINAL_REQUEST.md R5 |
| 15 | R3: Catalog | Dynamic Frontend Hydration | `index.html` JavaScript dynamically fetches `/api/products` and populates the `#products` grid and carousel | DOM load event in `index.html` | Rendered HTML cards with live prices, images, badges | Graceful fallback to default static cards if API is unreachable | ORIGINAL_REQUEST.md R5 |
| 16 | R4: Ordering | Custom Tag Configuration & Validation | Validate Spotify song link/URI, track name, artist, and custom back text length (<= 30 chars) | Client-side input + server validation in order creation | Sanitized customization metadata payload | 400 Bad Request if text > max length or invalid Spotify URI | ORIGINAL_REQUEST.md R1, R4 |
| 17 | R4: Ordering | Create Custom Order | Place a new order with customer shipping address, items, and customization parameters | `POST /api/orders` `{ items: [{ productId, quantity, customization: { spotifyUrl, songTitle, artistName, customText, previewConfig } }], shippingAddress: { name, phone, street, city, state, postalCode } }` | 201 Created `{ orderId, orderNumber, totalAmount, currency, status: "PENDING_PAYMENT" }` | 400 Validation Error, 404 Product Not Found, 409 Out of Stock | ORIGINAL_REQUEST.md R1, R4 |
| 18 | R4: Ordering | Public / Guest Order Tracking | Lookup order status using order number and customer email or phone | `GET /api/orders/track?orderNumber=...&email=...` | 200 OK `{ orderNumber, status, createdAt, updatedAt, items, trackingNumber, courierName, timeline: [...] }` | 404 Order Not Found, 400 Missing Query Params | ORIGINAL_REQUEST.md R4 |
| 19 | R4: Ordering | Authenticated Customer Order History | Retrieve all past and current orders for the logged-in customer | `GET /api/orders/my-orders` | 200 OK `[ { id, orderNumber, totalAmount, status, items, createdAt, trackingTimeline } ]` | 401 Unauthorized | ORIGINAL_REQUEST.md R4 |
| 20 | R4: Ordering | Admin Order Listing & Filter | List all orders with filters by status (`PENDING_PAYMENT`, `ORDER_RECEIVED`, `ENGRAVING`, `DISPATCHED`, `DELIVERED`, `CANCELLED`), search by customer name/email/orderNumber | `GET /api/admin/orders?status=...&search=...&page=...` | 200 OK `{ orders: [...], totalCount, page, totalPages }` | 401/403 Unauthorized | ORIGINAL_REQUEST.md R5 |
| 21 | R4: Ordering | Admin Order Status Fulfillment Update | Update order status along the lifecycle (e.g. mark as `ENGRAVING`, `DISPATCHED` with courier & tracking number, `DELIVERED`) | `PATCH /api/admin/orders/:id/status` `{ status: "ENGRAVING"|"DISPATCHED"|"DELIVERED"|"CANCELLED", trackingNumber, courierName, notes }` | 200 OK `{ id, orderNumber, status, trackingNumber, courierName, updatedAt }` | 401/403 Unauthorized, 400 Invalid State Transition, 404 Not Found | ORIGINAL_REQUEST.md R4, R5 |
| 22 | R5: Payments | Razorpay Order Creation | Create a Razorpay gateway order on the server with exact price calculation from DB | `POST /api/payments/create-order` `{ orderId }` | 200 OK `{ razorpayOrderId, amount, currency: "INR", keyId }` | 400 Bad Request, 404 Order Not Found, 409 Order Already Paid | ORIGINAL_REQUEST.md R3 |
| 23 | R5: Payments | Razorpay Signature Verification | Verify `razorpay_signature` via HMAC-SHA256(`order_id|payment_id`, secret) and transition order to `ORDER_RECEIVED` | `POST /api/payments/verify` `{ orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature }` | 200 OK `{ success: true, orderId, status: "ORDER_RECEIVED", paymentId }` | 400 Invalid Signature / Verification Failed, 404 Order Not Found | ORIGINAL_REQUEST.md R3 |
| 24 | R5: Payments | Razorpay Webhook Ingestion | Process asynchronous gateway notifications (`payment.captured`, `payment.failed`, `order.paid`) with HMAC signature header verification and idempotent handling | `POST /api/payments/webhook` (Headers: `x-razorpay-signature`, Body: raw JSON) | 200 OK `{ status: "processed" }` | 400 Invalid Webhook Signature, 500 Webhook Error | ORIGINAL_REQUEST.md R3 |
| 25 | R5: Payments | Mock Payment Mode for Testing | Offline deterministic mock payment provider for automated testing without live API keys | Config flag `MOCK_PAYMENTS=true` in `POST /api/payments/*` | 200 OK with simulated Razorpay order ID and valid mock signature | 400 on mock failure simulation trigger | Codebase & Test Requirements |
| 26 | R6: Customer UI | Customizer Modal & Spotify Preview | Interactive UI modal on `index.html` allowing users to type song link/title, preview engraved keychain, enter custom text, and trigger checkout | User clicks "Order Now" on product card in `index.html` | Live visual preview of keychain with Spotify code bars & text, checkout modal trigger | Inline validation errors for missing fields or long text | ORIGINAL_REQUEST.md R1, R4 |
| 27 | R6: Customer UI | Customer Dashboard UI | Dedicated customer portal (`dashboard.html` / `/dashboard`) displaying active orders, live timeline progress bar, Spotify song link, and profile | User navigates to `/dashboard` while authenticated | Rendered order cards with timeline: Received -> Engraving -> Dispatched -> Delivered | Redirects to login modal if unauthenticated | ORIGINAL_REQUEST.md R4 |
| 28 | R7: Admin UI | Developer Admin Portal UI | Secure administrative web interface (`admin.html` / `/admin`) with dashboard metrics, product management, and order fulfillment panel | Navigates to `/admin` with developer admin credentials/JWT | Interactive tabs: Overview Stats, Product Catalog CRUD with Image Upload, Orders & Fulfillment Updater | 401/403 Redirect to Admin Login Gate | ORIGINAL_REQUEST.md R5 |

---

## 3. Comprehensive Feature Inventory & REST API Specifications

### Category 1: Backend Infrastructure & Database (R1.x)

#### R1.1: Server Bootstrap & Health Diagnostics
- **Endpoint**: `GET /api/health`
- **Auth**: Public (None)
- **Request Headers**: `Accept: application/json`
- **Request Body**: None
- **Response 200 OK**:
  ```json
  {
    "status": "ok",
    "service": "tunetagz-backend",
    "version": "1.0.0",
    "timestamp": "2026-08-17T14:15:00.000Z",
    "uptime": 128.45,
    "database": {
      "type": "sqlite",
      "connected": true,
      "tables": ["users", "products", "orders", "order_items", "payments", "admin_audit_logs"]
    }
  }
  ```
- **Error Responses**:
  - `500 Internal Server Error`: `{ "status": "error", "message": "Database connection unhealthy" }`
- **Validation & Logic**: Executes `SELECT 1` on SQLite database. Returns total process uptime and ISO timestamp.

#### R1.2: Database Initialization & Migrations
- **Implementation**: Synchronous or async SQLite initialization using `better-sqlite3` or `sqlite3` driver.
- **File**: `tunetagz.db` in project root or `data/` directory.
- **Tables Initialized**:
  - `users`: Customer & Admin accounts.
  - `products`: Catalog items, prices, SKUs, inventory states, images.
  - `orders`: Master order records, shipping details, total amount, status.
  - `order_items`: Line items with custom Spotify data and engraving text.
  - `payments`: Razorpay transaction records, payment ID, signature, status.
  - `admin_audit_logs`: Audit trail for price changes, status updates, cancellations.
- **Seed Data**: Pre-seeds SPT-001 (Spotify Code Tag, ₹699, `POSTER 1.png`), RKY-001 (Rocky Keychain, ₹300, `POSTER 2.png`), Drop 03 (Coming Soon, ₹0, TBA), and default Developer Admin account (`admin@tunetagz.com` / `admin12345` or configurable via ENV).

#### R1.3: Static Asset Serving & Upload Storage
- **Static Endpoints**:
  - `GET /` -> Serves `k:\projects\tunetags\index.html`
  - `GET /admin` or `/admin.html` -> Serves `k:\projects\tunetags\admin.html`
  - `GET /dashboard` or `/dashboard.html` -> Serves `k:\projects\tunetags\dashboard.html`
  - `GET /uploads/:filename` -> Serves uploaded product images from `k:\projects\tunetags\uploads/`
  - `GET /:asset` -> Serves root static assets (`TUNETAGZ LOGO.png`, `POSTER 1.png`, `POSTER 2.png`, `PRODUCT 1.png`, `PRODUCT 2.png`, `manifest.json`, `robots.txt`, `sitemap.xml`)
- **Upload Directory**: `k:\projects\tunetags\uploads/`
- **MIME Types Allowed**: `image/png`, `image/jpeg`, `image/jpg`, `image/webp`
- **Max File Size**: 5 MB (5,242,880 bytes).

---

### Category 2: Customer & Developer Authentication & RBAC (R2.x)

#### R2.1: Customer Registration
- **Endpoint**: `POST /api/auth/register`
- **Auth**: Public
- **Request Body Schema**:
  ```json
  {
    "email": "customer@example.com",
    "password": "StrongPassword123!",
    "name": "Arjun Sharma",
    "phone": "+919876543210"
  }
  ```
- **Validation Rules**:
  - `email`: Required, valid email format (RFC 5322 regex), lowercase trimmed, max 255 chars.
  - `password`: Required, minimum 6 characters (recommended 8+), hashed with bcrypt (salt rounds >= 10) or argon2.
  - `name`: Required, 2 to 100 characters, trimmed.
  - `phone`: Optional / string, valid 10-digit Indian number or international format (+91...).
- **Response 201 Created**:
  ```json
  {
    "success": true,
    "message": "User registered successfully",
    "user": {
      "id": 1,
      "email": "customer@example.com",
      "name": "Arjun Sharma",
      "phone": "+919876543210",
      "role": "customer",
      "createdAt": "2026-08-17T14:20:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```
- **Response Headers**: `Set-Cookie: token=...; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`
- **Error Responses**:
  - `400 Bad Request`: `{ "error": "Validation failed", "details": ["Email is invalid", "Password must be at least 6 characters"] }`
  - `409 Conflict`: `{ "error": "Email already registered", "message": "An account with this email already exists" }`
  - `500 Internal Server Error`: `{ "error": "Registration failed due to internal error" }`

#### R2.2: Customer & Admin Login
- **Endpoint**: `POST /api/auth/login`
- **Auth**: Public
- **Request Body Schema**:
  ```json
  {
    "email": "customer@example.com",
    "password": "StrongPassword123!"
  }
  ```
- **Validation Rules**:
  - `email`: Required, valid email string.
  - `password`: Required, non-empty string.
- **Response 200 OK**:
  ```json
  {
    "success": true,
    "user": {
      "id": 1,
      "email": "customer@example.com",
      "name": "Arjun Sharma",
      "role": "customer",
      "phone": "+919876543210"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: `{ "error": "Missing email or password" }`
  - `401 Unauthorized`: `{ "error": "Invalid credentials", "message": "Incorrect email or password" }`
  - `403 Forbidden`: `{ "error": "Account suspended", "message": "Your account has been deactivated" }`

#### R2.3: Google OAuth 2.0 Login / ID Token Verification
- **Endpoint**: `POST /api/auth/google`
- **Auth**: Public
- **Request Body Schema**:
  ```json
  {
    "idToken": "google_credential_jwt_string_or_access_token",
    "profile": {
      "email": "customer@gmail.com",
      "name": "Arjun Sharma",
      "picture": "https://lh3.googleusercontent.com/a/...",
      "sub": "google_oauth_sub_id_12345"
    }
  }
  ```
- **Logic**:
  - Verifies token (via `google-auth-library` or simulated decoding in test environment).
  - If user exists by `google_id` or `email`, logs them in and links `google_id`.
  - If user does not exist, automatically registers new customer with `role: 'customer'`, random secure password hash, and marks `email_verified: 1`.
- **Response 200 OK**:
  ```json
  {
    "success": true,
    "user": {
      "id": 2,
      "email": "customer@gmail.com",
      "name": "Arjun Sharma",
      "role": "customer",
      "avatar": "https://lh3.googleusercontent.com/a/..."
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: `{ "error": "Google ID token required" }`
  - `401 Unauthorized`: `{ "error": "Invalid or expired Google token" }`

#### R2.4: Developer Admin Authentication
- **Endpoint**: `POST /api/auth/admin/login` (or standard login with admin credentials / header key)
- **Auth**: Public (Requires Admin Credentials or `ADMIN_SECRET`)
- **Request Body Schema**:
  ```json
  {
    "email": "admin@tunetagz.com",
    "password": "AdminSecurePassword123!"
  }
  ```
- **Response 200 OK**:
  ```json
  {
    "success": true,
    "user": {
      "id": 999,
      "email": "admin@tunetagz.com",
      "name": "TuneTagZ Developer Admin",
      "role": "admin"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
  ```
- **Error Responses**:
  - `401 Unauthorized`: `{ "error": "Invalid admin credentials" }`
  - `403 Forbidden`: `{ "error": "Access denied: Account is not an administrator" }`

#### R2.5: Current User Profile (`GET /api/auth/me`)
- **Endpoint**: `GET /api/auth/me`
- **Auth**: Authenticated (`customer` or `admin`)
- **Request Headers**: `Authorization: Bearer <JWT>` or Cookie `token=<JWT>`
- **Response 200 OK**:
  ```json
  {
    "user": {
      "id": 1,
      "email": "customer@example.com",
      "name": "Arjun Sharma",
      "phone": "+919876543210",
      "role": "customer",
      "createdAt": "2026-08-17T14:20:00.000Z"
    }
  }
  ```
- **Error Responses**:
  - `401 Unauthorized`: `{ "error": "Unauthorized", "message": "Missing or invalid authentication token" }`

#### R2.6: Logout (`POST /api/auth/logout`)
- **Endpoint**: `POST /api/auth/logout`
- **Auth**: Public / Authenticated
- **Response 200 OK**:
  ```json
  {
    "success": true,
    "message": "Logged out successfully"
  }
  ```
- **Response Headers**: Clears cookie `token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`

---

### Category 3: Product Catalog & Dynamic Frontend Sync (R3.x)

#### R3.1: Public Product Catalog Listing
- **Endpoint**: `GET /api/products`
- **Auth**: Public
- **Query Parameters**:
  - `inStock`: `boolean` (optional, filter only in-stock items)
  - `category`: `string` (optional)
- **Response 200 OK**:
  ```json
  [
    {
      "id": 1,
      "sku": "SPT-001",
      "name": "Spotify Code Tag",
      "description": "Scan and play. Your favorite track engraved in gold on matte black — with your name on the back. The ultimate gift for any music lover.",
      "price": 699,
      "currency": "INR",
      "imageUrl": "POSTER 1.png",
      "badge": "Bestseller",
      "inStock": true,
      "comingSoon": false,
      "isCustomizable": true,
      "displayOrder": 1,
      "createdAt": "2026-08-17T14:00:00.000Z"
    },
    {
      "id": 2,
      "sku": "RKY-001",
      "name": "Rocky Keychain",
      "description": "A wearable sculpture for your keys. Intricate maze-pattern 3D printed figure in matte black — bold, tactile, and unlike anything else on the market.",
      "price": 300,
      "currency": "INR",
      "imageUrl": "POSTER 2.png",
      "badge": "New",
      "inStock": true,
      "comingSoon": false,
      "isCustomizable": false,
      "displayOrder": 2,
      "createdAt": "2026-08-17T14:00:00.000Z"
    },
    {
      "id": 3,
      "sku": "DROP-003",
      "name": "Drop 03",
      "description": "Something new is dropping. Follow us on Instagram to be the first to know when our third collection goes live.",
      "price": 0,
      "currency": "INR",
      "imageUrl": "",
      "badge": "Drop 03 — 2026",
      "inStock": false,
      "comingSoon": true,
      "isCustomizable": false,
      "displayOrder": 3,
      "createdAt": "2026-08-17T14:00:00.000Z"
    }
  ]
  ```
- **Error Responses**:
  - `500 Internal Server Error`: `{ "error": "Failed to fetch products" }`

#### R3.2: Product Details by ID
- **Endpoint**: `GET /api/products/:id`
- **Auth**: Public
- **Response 200 OK**: Single product object as defined in R3.1.
- **Error Responses**:
  - `404 Not Found`: `{ "error": "Product not found" }`

#### R3.3: Admin Product Creation with Multer Image Upload
- **Endpoint**: `POST /api/products`
- **Auth**: Admin (`role: 'admin'`)
- **Content-Type**: `multipart/form-data`
- **Form Fields**:
  - `file`: Image file (PNG, JPG, WEBP <= 5MB)
  - `name`: string (Required, 2-150 chars)
  - `sku`: string (Required, unique, 2-50 chars, e.g. "SPT-002")
  - `description`: string (Required, 5-1000 chars)
  - `price`: number/integer >= 0 (in INR, e.g. 699)
  - `badge`: string (Optional, e.g. "Bestseller", "New", "Limited")
  - `inStock`: boolean or string ("true"/"false", default true)
  - `comingSoon`: boolean or string ("true"/"false", default false)
  - `isCustomizable`: boolean or string ("true"/"false", default true)
  - `displayOrder`: number (default 0)
- **Response 201 Created**:
  ```json
  {
    "success": true,
    "product": {
      "id": 4,
      "sku": "SPT-002",
      "name": "Silver Spotify Tag",
      "description": "Engraved in silver on matte obsidian.",
      "price": 749,
      "currency": "INR",
      "imageUrl": "/uploads/product-1723903820-silver.png",
      "badge": "Limited Edition",
      "inStock": true,
      "comingSoon": false,
      "isCustomizable": true,
      "displayOrder": 4,
      "createdAt": "2026-08-17T14:25:00.000Z"
    }
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: `{ "error": "Validation error", "details": ["Price must be a positive integer", "Name is required"] }`
  - `401 Unauthorized`: `{ "error": "Authentication required" }`
  - `403 Forbidden`: `{ "error": "Admin privileges required" }`
  - `409 Conflict`: `{ "error": "SKU already exists" }`
  - `415 Unsupported Media Type`: `{ "error": "Only image files (PNG, JPG, WEBP) are allowed" }`

#### R3.4: Admin Product Update
- **Endpoint**: `PUT /api/products/:id` or `PATCH /api/products/:id`
- **Auth**: Admin (`role: 'admin'`)
- **Content-Type**: `multipart/form-data` or `application/json`
- **Response 200 OK**: Updated product object.
- **Error Responses**:
  - `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`

#### R3.5: Admin Product Deletion
- **Endpoint**: `DELETE /api/products/:id`
- **Auth**: Admin (`role: 'admin'`)
- **Response 200 OK**:
  ```json
  {
    "success": true,
    "message": "Product removed from catalog",
    "deletedId": 4
  }
  ```
- **Error Responses**:
  - `404 Not Found`: `{ "error": "Product not found" }`
  - `409 Conflict`: `{ "error": "Cannot delete product with existing fulfilled orders (soft-delete applied)" }`

#### R3.6: Admin Toggle Stock Availability
- **Endpoint**: `PATCH /api/products/:id/stock`
- **Auth**: Admin (`role: 'admin'`)
- **Request Body**:
  ```json
  {
    "inStock": false
  }
  ```
- **Response 200 OK**:
  ```json
  {
    "success": true,
    "id": 1,
    "inStock": false,
    "message": "Stock status updated to out of stock"
  }
  ```

#### R3.7: Dynamic Frontend Sync in `index.html`
- **Client Script Logic in `index.html`**:
  1. On `DOMContentLoaded`, calls `fetch('/api/products')`.
  2. If response is successful, parses JSON array of products.
  3. Replaces static cards inside `.products-grid` with dynamically generated product cards:
     - Formats price using currency symbol (₹ + price).
     - Renders image using `imageUrl` (handling both root assets and `/uploads/...` paths).
     - Binds "Order Now" / "Customize" button to open the Customizer modal with pre-selected `productId`.
     - Displays `badge`, `psku`, and stock indicators ("Out of Stock" button disable if `inStock === false`).
  4. If fetch fails (offline or server starting), silently preserves the hardcoded fallback cards so the page remains visually functional.

---

### Category 4: Customization Engine & Order Lifecycle (R4.x)

#### R4.1: Custom Tag Order Calculation & Draft
- **Endpoint**: `POST /api/orders/calculate` (or inline validation during order creation)
- **Auth**: Public / Customer
- **Request Body**:
  ```json
  {
    "items": [
      {
        "productId": 1,
        "quantity": 2,
        "customization": {
          "spotifyUrl": "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT",
          "songTitle": "Starboy",
          "artistName": "The Weeknd",
          "customText": "Arjun & Sneha 2026",
          "previewConfig": {
            "finish": "matte_gold",
            "barCount": 23,
            "showText": true
          }
        }
      }
    ]
  }
  ```
- **Response 200 OK**:
  ```json
  {
    "subtotal": 1398,
    "shippingFee": 0,
    "tax": 0,
    "totalAmount": 1398,
    "currency": "INR",
    "itemCount": 2
  }
  ```

#### R4.2: Spotify Code & Song URL Validation Rules
- **Supported Formats**:
  - Spotify Web Track URL: `https://open.spotify.com/track/[a-zA-Z0-9]{22}(\?.*)?`
  - Spotify Web Album URL: `https://open.spotify.com/album/[a-zA-Z0-9]{22}(\?.*)?`
  - Spotify Web Playlist URL: `https://open.spotify.com/playlist/[a-zA-Z0-9]{22}(\?.*)?`
  - Spotify URI: `spotify:track:[a-zA-Z0-9]{22}`, `spotify:album:[a-zA-Z0-9]{22}`
- **Custom Back Text**:
  - Character limit: Maximum 30 alphanumeric/punctuation characters.
  - Sanitization: HTML tag stripping, UTF-8 normalization.

#### R4.3: Create Custom Order
- **Endpoint**: `POST /api/orders`
- **Auth**: Optional Guest / Authenticated Customer (If authenticated, order is automatically linked to `user_id`)
- **Request Body Schema**:
  ```json
  {
    "customer": {
      "name": "Arjun Sharma",
      "email": "arjun@example.com",
      "phone": "+919876543210"
    },
    "shippingAddress": {
      "fullName": "Arjun Sharma",
      "phone": "+919876543210",
      "addressLine1": "Flat 402, Green Valley Apartments",
      "addressLine2": "Indiranagar 100ft Road",
      "city": "Bengaluru",
      "state": "Karnataka",
      "postalCode": "560038",
      "country": "India"
    },
    "items": [
      {
        "productId": 1,
        "quantity": 1,
        "customization": {
          "spotifyUrl": "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT",
          "songTitle": "Starboy",
          "artistName": "The Weeknd",
          "customText": "Arjun 2026",
          "previewConfig": { "finish": "gold" }
        }
      }
    ],
    "notes": "Please engrave carefully on the center line"
  }
  ```
- **Validation Rules**:
  - Validates each `productId` against database.
  - Ensures product is `inStock: true` and not `comingSoon: true`.
  - Calculates total price strictly from database `products.price` (ignores client-submitted price).
  - Generates a unique human-friendly `orderNumber` (e.g., `TTZ-20260817-A8F2`).
- **Response 201 Created**:
  ```json
  {
    "success": true,
    "order": {
      "id": 101,
      "orderNumber": "TTZ-20260817-A8F2",
      "status": "PENDING_PAYMENT",
      "totalAmount": 699,
      "currency": "INR",
      "itemCount": 1,
      "customerEmail": "arjun@example.com",
      "createdAt": "2026-08-17T14:30:00.000Z"
    }
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: `{ "error": "Validation failed", "details": ["Postal code must be 6 digits", "Spotify URL is required for Spotify Code Tag"] }`
  - `404 Not Found`: `{ "error": "Product ID 1 not found" }`
  - `409 Conflict`: `{ "error": "Product 'Spotify Code Tag' is currently out of stock" }`

#### R4.4: Public & Guest Order Tracking
- **Endpoint**: `GET /api/orders/track`
- **Auth**: Public
- **Query Parameters**:
  - `orderNumber`: `string` (Required, e.g. `TTZ-20260817-A8F2`)
  - `email` or `phone`: `string` (Required for guest verification)
- **Response 200 OK**:
  ```json
  {
    "orderNumber": "TTZ-20260817-A8F2",
    "status": "ENGRAVING",
    "statusDisplay": "In Engraving",
    "totalAmount": 699,
    "currency": "INR",
    "createdAt": "2026-08-17T14:30:00.000Z",
    "updatedAt": "2026-08-17T16:00:00.000Z",
    "items": [
      {
        "productName": "Spotify Code Tag",
        "sku": "SPT-001",
        "quantity": 1,
        "unitPrice": 699,
        "customization": {
          "songTitle": "Starboy",
          "artistName": "The Weeknd",
          "spotifyUrl": "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT",
          "customText": "Arjun 2026"
        }
      }
    ],
    "shipping": {
      "city": "Bengaluru",
      "state": "Karnataka",
      "postalCode": "560038",
      "courierName": "BlueDart Express",
      "trackingNumber": "BD-98234110IN",
      "estimatedDelivery": "2026-08-22"
    },
    "timeline": [
      { "status": "ORDER_RECEIVED", "label": "Order Received", "timestamp": "2026-08-17T14:32:00.000Z", "completed": true },
      { "status": "ENGRAVING", "label": "Laser Engraving in Progress", "timestamp": "2026-08-17T16:00:00.000Z", "completed": true },
      { "status": "DISPATCHED", "label": "Dispatched with BlueDart", "timestamp": null, "completed": false },
      { "status": "DELIVERED", "label": "Delivered to Customer", "timestamp": null, "completed": false }
    ]
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: `{ "error": "orderNumber and email/phone query parameters are required" }`
  - `404 Not Found`: `{ "error": "Order not found or verification failed" }`

#### R4.5: Authenticated Customer Order History
- **Endpoint**: `GET /api/orders/my-orders`
- **Auth**: Customer (`role: 'customer'` or `'admin'`)
- **Response 200 OK**:
  ```json
  [
    {
      "id": 101,
      "orderNumber": "TTZ-20260817-A8F2",
      "status": "ENGRAVING",
      "totalAmount": 699,
      "currency": "INR",
      "itemCount": 1,
      "items": [
        {
          "productName": "Spotify Code Tag",
          "imageUrl": "POSTER 1.png",
          "quantity": 1,
          "customText": "Arjun 2026",
          "songTitle": "Starboy"
        }
      ],
      "createdAt": "2026-08-17T14:30:00.000Z",
      "courierName": "BlueDart Express",
      "trackingNumber": "BD-98234110IN"
    }
  ]
  ```

#### R4.6: Admin Order Listing & Search
- **Endpoint**: `GET /api/admin/orders`
- **Auth**: Admin (`role: 'admin'`)
- **Query Parameters**:
  - `status`: `string` (e.g. `PENDING_PAYMENT`, `ORDER_RECEIVED`, `ENGRAVING`, `DISPATCHED`, `DELIVERED`, `CANCELLED`)
  - `search`: `string` (searches orderNumber, customer name, email, phone)
  - `page`: `number` (default 1)
  - `limit`: `number` (default 20)
- **Response 200 OK**:
  ```json
  {
    "orders": [
      {
        "id": 101,
        "orderNumber": "TTZ-20260817-A8F2",
        "customerName": "Arjun Sharma",
        "customerEmail": "arjun@example.com",
        "customerPhone": "+919876543210",
        "status": "ENGRAVING",
        "totalAmount": 699,
        "paymentStatus": "PAID",
        "paymentId": "pay_O123456789",
        "itemCount": 1,
        "items": [
          {
            "productName": "Spotify Code Tag",
            "quantity": 1,
            "spotifyUrl": "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT",
            "songTitle": "Starboy",
            "artistName": "The Weeknd",
            "customText": "Arjun 2026"
          }
        ],
        "shippingAddress": "Flat 402, Green Valley Apartments, Bengaluru, Karnataka - 560038",
        "courierName": "BlueDart Express",
        "trackingNumber": "BD-98234110IN",
        "createdAt": "2026-08-17T14:30:00.000Z",
        "updatedAt": "2026-08-17T16:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
  ```

#### R4.7: Admin Order Status & Fulfillment Updater
- **Endpoint**: `PATCH /api/admin/orders/:id/status`
- **Auth**: Admin (`role: 'admin'`)
- **Request Body Schema**:
  ```json
  {
    "status": "DISPATCHED",
    "courierName": "BlueDart Express",
    "trackingNumber": "BD-98234110IN",
    "notes": "Handed over to courier hub"
  }
  ```
- **Validation Rules**:
  - Enforces valid state machine transition (see Section 4).
  - If `status === 'DISPATCHED'`, `courierName` and `trackingNumber` are validated.
  - Records an audit log entry in `admin_audit_logs`.
- **Response 200 OK**:
  ```json
  {
    "success": true,
    "id": 101,
    "orderNumber": "TTZ-20260817-A8F2",
    "status": "DISPATCHED",
    "courierName": "BlueDart Express",
    "trackingNumber": "BD-98234110IN",
    "updatedAt": "2026-08-17T17:00:00.000Z"
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: `{ "error": "Invalid state transition from DELIVERED to ENGRAVING" }`
  - `404 Not Found`: `{ "error": "Order not found" }`

---

### Category 5: Razorpay Payment Gateway Integration (R5.x)

#### R5.1: Create Razorpay Gateway Order
- **Endpoint**: `POST /api/payments/create-order`
- **Auth**: Public / Customer
- **Request Body**:
  ```json
  {
    "orderId": 101
  }
  ```
- **Server Execution Logic**:
  1. Finds order record with `id = 101`.
  2. Verifies order is in `PENDING_PAYMENT` state.
  3. Converts `totalAmount` in INR to paise (`amountPaise = totalAmount * 100`, e.g., `69900` paise).
  4. Calls Razorpay Orders API (`razorpay.orders.create({ amount: 69900, currency: "INR", receipt: "TTZ-20260817-A8F2", notes: { orderId: 101 } })`) or generates mock order in test environment.
  5. Updates `orders.razorpay_order_id` in database.
- **Response 200 OK**:
  ```json
  {
    "success": true,
    "razorpayOrderId": "order_O9876543210",
    "orderId": 101,
    "orderNumber": "TTZ-20260817-A8F2",
    "amount": 69900,
    "currency": "INR",
    "keyId": "rzp_test_TuneTagzKey123",
    "customer": {
      "name": "Arjun Sharma",
      "email": "arjun@example.com",
      "phone": "+919876543210"
    }
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: `{ "error": "Order ID is required" }`
  - `404 Not Found`: `{ "error": "Order not found" }`
  - `409 Conflict`: `{ "error": "Order has already been paid or is cancelled" }`

#### R5.2: Verify Razorpay Payment Signature
- **Endpoint**: `POST /api/payments/verify`
- **Auth**: Public / Customer
- **Request Body**:
  ```json
  {
    "orderId": 101,
    "razorpayOrderId": "order_O9876543210",
    "razorpayPaymentId": "pay_P1234567890",
    "razorpaySignature": "4a7b98...hmac_sha256_hex_digest"
  }
  ```
- **Cryptographic Verification Algorithm**:
  ```js
  const crypto = require('crypto');
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'mock_secret')
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');
  const isSignatureValid = (expectedSignature === razorpaySignature);
  ```
- **Database Side Effects upon Success**:
  1. Inserts record into `payments` table with `status = 'CAPTURED'`, `method = 'UPI/Card'`, `razorpay_payment_id`.
  2. Updates `orders` table: `status = 'ORDER_RECEIVED'`, `payment_status = 'PAID'`, `paid_at = CURRENT_TIMESTAMP`.
- **Response 200 OK**:
  ```json
  {
    "success": true,
    "message": "Payment verified and order confirmed",
    "orderId": 101,
    "orderNumber": "TTZ-20260817-A8F2",
    "status": "ORDER_RECEIVED",
    "paymentId": "pay_P1234567890"
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: `{ "error": "Invalid payment signature", "message": "HMAC verification failed" }`
  - `404 Not Found`: `{ "error": "Order not found" }`
  - `409 Conflict`: `{ "error": "Payment already captured for this order" }`

#### R5.3: Razorpay Webhook Ingestion & Idempotency
- **Endpoint**: `POST /api/payments/webhook`
- **Auth**: Webhook Signature (`X-Razorpay-Signature` Header)
- **Header**: `x-razorpay-signature: <hmac_hex>`
- **Request Body**: Raw JSON payload from Razorpay.
- **Verification**: `crypto.createHmac('sha256', RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex') === req.headers['x-razorpay-signature']`
- **Events Handled**:
  - `payment.captured` / `order.paid`: Finds order by `payload.payment.entity.order_id`, marks status as `ORDER_RECEIVED` and payment as `PAID`.
  - `payment.failed`: Records failed payment attempt in `payments` table.
- **Idempotency**: Checks if payment ID was already processed. If yes, returns 200 OK immediately without double-updating.
- **Response 200 OK**:
  ```json
  {
    "status": "ok",
    "event": "payment.captured",
    "processed": true
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: `{ "error": "Invalid webhook signature" }`

---

## 4. Order Lifecycle State Machine

```
               [Customer Places Order]
                          │
                          ▼
                 ┌─────────────────┐
                 │ PENDING_PAYMENT │ ◄── Initial State upon POST /api/orders
                 └────────┬────────┘
                          │
         Payment Success  │  Payment Timeout / User Cancel
         (verify/webhook) │
                          │
                          ▼
                 ┌─────────────────┐
                 │ ORDER_RECEIVED  │ ◄── Payment Verified (Stock locked, Queued)
                 └────────┬────────┘
                          │
                          │ Admin initiates production
                          ▼
                 ┌─────────────────┐
                 │    ENGRAVING    │ ◄── Custom Spotify bars & text being laser engraved
                 └────────┬────────┘
                          │
                          │ Handover to Courier (Tracking # assigned)
                          ▼
                 ┌─────────────────┐
                 │   DISPATCHED    │ ◄── In transit with Courier
                 └────────┬────────┘
                          │
                          │ Delivery confirmed
                          ▼
                 ┌─────────────────┐
                 │    DELIVERED    │ ◄── Terminal Success State
                 └─────────────────┘

     [From PENDING_PAYMENT, ORDER_RECEIVED, or ENGRAVING]
                          │
                          │ Admin / User Cancellation
                          ▼
                 ┌─────────────────┐
                 │    CANCELLED    │ ◄── Terminal Cancellation State
                 └────────┬────────┘
                          │
                          │ (If payment was captured)
                          ▼
                 ┌─────────────────┐
                 │    REFUNDED     │ ◄── Refund processed via Razorpay
                 └─────────────────┘
```

### State Machine Transition Rules Table

| Current State | Next State | Allowed Actor | Trigger / Precondition | Side Effects |
|---|---|---|---|---|
| `[None]` | `PENDING_PAYMENT` | Guest / Customer | `POST /api/orders` | Order created, items saved, pricing validated |
| `PENDING_PAYMENT` | `ORDER_RECEIVED` | System / Razorpay | `POST /api/payments/verify` or Webhook | Payment record saved, `payment_status = 'PAID'`, `paid_at = NOW()` |
| `PENDING_PAYMENT` | `CANCELLED` | Customer / Admin / Cron | Payment timeout (>30 min) or customer abandons | Status marked `CANCELLED`, payment marked `FAILED` |
| `ORDER_RECEIVED` | `ENGRAVING` | Developer Admin | Admin accepts order and starts 3D print/engraving | Timeline updated, audit log written |
| `ENGRAVING` | `DISPATCHED` | Developer Admin | Tracking number & Courier name entered | `trackingNumber` & `courierName` saved, customer tracking active |
| `DISPATCHED` | `DELIVERED` | Developer Admin / Webhook | Courier confirms delivery | Terminal state, fulfillment complete |
| `ORDER_RECEIVED` | `CANCELLED` | Developer Admin | Customer request / defect / out of stock | `CANCELLED`, triggers Razorpay refund if requested |
| `ENGRAVING` | `CANCELLED` | Developer Admin | Customization defect / cancellation | `CANCELLED`, triggers refund |
| `CANCELLED` | `REFUNDED` | Developer Admin | `POST /api/admin/orders/:id/refund` | Payment status marked `REFUNDED`, Razorpay refund API called |

**Illegal Transitions (Strictly Rejected with HTTP 400)**:
- `DELIVERED` -> `PENDING_PAYMENT`, `ENGRAVING`, `ORDER_RECEIVED` (Cannot modify completed order)
- `CANCELLED` -> `DISPATCHED`, `DELIVERED`, `ENGRAVING` (Cannot ship cancelled order)
- `PENDING_PAYMENT` -> `ENGRAVING`, `DISPATCHED`, `DELIVERED` (Cannot produce unpaid order)

---

## 5. Role-Based Access Control (RBAC) Specification

| Resource / Endpoint | Method | Public (Guest) | Authenticated Customer | Developer Admin |
|---|---|:---:|:---:|:---:|
| `GET /api/health` | GET | Allowed | Allowed | Allowed |
| `GET /api/products` | GET | Allowed | Allowed | Allowed |
| `GET /api/products/:id` | GET | Allowed | Allowed | Allowed |
| `POST /api/auth/register` | POST | Allowed | Allowed | Allowed |
| `POST /api/auth/login` | POST | Allowed | Allowed | Allowed |
| `POST /api/auth/google` | POST | Allowed | Allowed | Allowed |
| `GET /api/auth/me` | GET | Denied (401) | Allowed (Self) | Allowed (Self) |
| `POST /api/auth/logout` | POST | Allowed | Allowed | Allowed |
| `POST /api/orders` | POST | Allowed (Guest) | Allowed (Linked) | Allowed |
| `GET /api/orders/track` | GET | Allowed (with query) | Allowed | Allowed |
| `GET /api/orders/my-orders` | GET | Denied (401) | Allowed (Self) | Allowed (Self) |
| `POST /api/payments/create-order`| POST | Allowed | Allowed | Allowed |
| `POST /api/payments/verify` | POST | Allowed | Allowed | Allowed |
| `POST /api/payments/webhook` | POST | Allowed (Sig Verify)| Allowed (Sig Verify)| Allowed (Sig Verify)|
| `POST /api/products` | POST | Denied (401/403) | Denied (403) | **Allowed** |
| `PUT /api/products/:id` | PUT | Denied (401/403) | Denied (403) | **Allowed** |
| `DELETE /api/products/:id` | DELETE| Denied (401/403) | Denied (403) | **Allowed** |
| `PATCH /api/products/:id/stock` | PATCH | Denied (401/403) | Denied (403) | **Allowed** |
| `GET /api/admin/orders` | GET | Denied (401/403) | Denied (403) | **Allowed** |
| `PATCH /api/admin/orders/:id/status`| PATCH | Denied (401/403) | Denied (403) | **Allowed** |
| `POST /api/admin/orders/:id/cancel`| POST | Denied (401/403) | Denied (403) | **Allowed** |
| `GET /api/admin/stats` | GET | Denied (401/403) | Denied (403) | **Allowed** |

### Authorization Mechanism
- **JWT Header**: `Authorization: Bearer <token>`
- **Cookie Support**: `Cookie: token=<token>`
- **Payload Schema**:
  ```json
  {
    "userId": 1,
    "email": "admin@tunetagz.com",
    "role": "admin",
    "iat": 1723903800,
    "exp": 1724508600
  }
  ```
- **Middleware Layers**:
  1. `authenticateToken`: Extracts and verifies JWT from header or cookie; attaches `req.user`.
  2. `requireAdmin`: Checks `req.user && req.user.role === 'admin'`. Returns 403 Forbidden if not admin.
  3. `optionalAuth`: Extracts user if token is present, proceeds anonymously if absent.

---

## 6. Database Schema Specification (SQLite / DDL)

```sql
-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'customer' CHECK(role IN ('customer', 'admin')),
  google_id TEXT UNIQUE,
  avatar_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Products Table
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  price INTEGER NOT NULL DEFAULT 0, -- Stored in whole INR (e.g. 699)
  currency TEXT NOT NULL DEFAULT 'INR',
  image_url TEXT NOT NULL,
  badge TEXT,
  in_stock INTEGER NOT NULL DEFAULT 1 CHECK(in_stock IN (0, 1)),
  coming_soon INTEGER NOT NULL DEFAULT 0 CHECK(coming_soon IN (0, 1)),
  is_customizable INTEGER NOT NULL DEFAULT 1 CHECK(is_customizable IN (0, 1)),
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Orders Table
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT UNIQUE NOT NULL,
  user_id INTEGER,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  shipping_address_line1 TEXT NOT NULL,
  shipping_address_line2 TEXT,
  shipping_city TEXT NOT NULL,
  shipping_state TEXT NOT NULL,
  shipping_postal_code TEXT NOT NULL,
  shipping_country TEXT NOT NULL DEFAULT 'India',
  total_amount INTEGER NOT NULL, -- in whole INR
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'PENDING_PAYMENT' CHECK(status IN ('PENDING_PAYMENT', 'ORDER_RECEIVED', 'ENGRAVING', 'DISPATCHED', 'DELIVERED', 'CANCELLED', 'REFUNDED')),
  payment_status TEXT NOT NULL DEFAULT 'UNPAID' CHECK(payment_status IN ('UNPAID', 'PAID', 'FAILED', 'REFUNDED')),
  razorpay_order_id TEXT,
  courier_name TEXT,
  tracking_number TEXT,
  notes TEXT,
  paid_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Order Items Table
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  product_name TEXT NOT NULL,
  product_sku TEXT NOT NULL,
  unit_price INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  total_price INTEGER NOT NULL,
  -- Customization parameters
  spotify_url TEXT,
  song_title TEXT,
  artist_name TEXT,
  custom_text TEXT,
  preview_config JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Payments Table
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  razorpay_order_id TEXT NOT NULL,
  razorpay_payment_id TEXT UNIQUE,
  razorpay_signature TEXT,
  amount INTEGER NOT NULL, -- in paise
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL CHECK(status IN ('CREATED', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED')),
  method TEXT,
  error_code TEXT,
  error_description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- Admin Audit Logs Table
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_user_id INTEGER,
  action TEXT NOT NULL,
  target_entity TEXT NOT NULL,
  target_id TEXT NOT NULL,
  old_value JSON,
  new_value JSON,
  ip_address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes for Query Optimization
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_order_id ON payments(razorpay_order_id);
```

---

## 7. Edge Cases & Boundary Scenarios

| # | Feature | Input / Condition | Observed / Required Behavior |
|---|---------|-------------------|-----------------------------|
| 1 | Product Pricing | Client submits `price: 1` in `POST /api/orders` | Server discards client price and queries `products.price` from SQLite DB (e.g. 699). Server calculates true total (₹699). Prevents price tampering attacks. |
| 2 | Out of Stock Ordering | Customer attempts to order product with `in_stock = 0` | Server rejects with `409 Conflict: Product is currently out of stock`. |
| 3 | Coming Soon Item | Customer orders `Drop 03` (`coming_soon = 1`) | Server rejects with `400 Bad Request: Cannot purchase coming soon product`. |
| 4 | Spotify Custom Text | User submits custom text with 35 characters | Server rejects with `400 Bad Request: customText exceeds maximum limit of 30 characters`. |
| 5 | Spotify URL Parsing | User submits shortened link `https://spotify.link/Abc123xyz` or standard URL | Server normalizes and extracts URI pattern or preserves URL for scanning preview. |
| 6 | Razorpay Tampering | Client manipulates `razorpay_signature` hex string | Server HMAC-SHA256 verification fails; returns `400 Bad Request: Invalid signature`, leaves order in `PENDING_PAYMENT`. |
| 7 | Replay Attack | Client calls `POST /api/payments/verify` multiple times with same valid signature | First call updates order to `ORDER_RECEIVED` (200 OK). Subsequent calls detect already paid status, return idempotent 200 OK or 409 Conflict without duplicate charges/fulfillment. |
| 8 | File Upload Extension Spoofing | Uploading `.exe` or `.php` file renamed to `malicious.png` | Multer fileFilter checks MIME type + file header magic bytes; rejects with `415 Unsupported Media Type`. |
| 9 | Duplicate Registration | Registering with existing email (case-insensitive e.g. `User@Test.com` vs `user@test.com`) | Lowercase normalization; returns `409 Conflict: Email already registered`. |
| 10 | Order Lifecycle Violation | Admin attempts to transition order from `DELIVERED` back to `PENDING_PAYMENT` | State machine validation fails; returns `400 Bad Request: Invalid state transition`. |
| 11 | Malformed JSON Payload | Client sends broken JSON with unmatched braces | Express body parser catches syntax error and returns `400 Bad Request: Malformed JSON`. |
| 12 | Database Concurrency | 50 simultaneous order requests placed within 100ms | SQLite transactional execution (`BEGIN IMMEDIATE TRANSACTION`) serializes order creation and payment updates cleanly without locked database errors or race conditions. |

---

## 8. 4-Tier Verification & Testing Matrix

### Tier 1: Unit & Feature Verification (Deterministic Logic)
- **T1.1: Password Hashing**: Verify `bcrypt.hash` generates valid hash and `bcrypt.compare` accurately validates correct/incorrect passwords.
- **T1.2: JWT Generation & Verification**: Verify `jwt.sign` and `jwt.verify` encode/decode `userId`, `email`, and `role` with correct expiration (e.g. 7 days).
- **T1.3: HMAC-SHA256 Signature Calculator**: Test signature calculation helper with known test vectors (`order_id`, `payment_id`, `secret`) and assert identical hex digest.
- **T1.4: Database Model CRUD**: Test SQL queries for user creation, product listing, order insertion, item linking, and status updates against in-memory or temporary SQLite database.
- **T1.5: Spotify Input Sanitizer**: Test regex matcher and length validator for song URLs, song titles, and custom back text.

### Tier 2: Boundary & Edge Case Verification
- **T2.1: Input Validation**:
  - Missing mandatory fields in registration, login, product creation, order placement.
  - Invalid email formatting (`notanemail`, `@missinguser.com`).
  - Passwords shorter than 6 characters.
  - Custom text > 30 characters.
  - Negative quantities (e.g. `quantity: -1` or `0`).
- **T2.2: Price Tampering Defense**:
  - Request with client-tampered `totalAmount: 1` -> Verify server charges exact DB price (699 * quantity).
- **T2.3: Security Header & Auth Gate**:
  - Accessing `/api/products` (POST/PUT/DELETE) without token -> 401 Unauthorized.
  - Accessing `/api/admin/orders` with customer token -> 403 Forbidden.
  - Accessing with expired or corrupted token -> 401 Unauthorized.
- **T2.4: File Upload Boundaries**:
  - File size > 5MB -> 400/413 Payload Too Large.
  - Invalid file type (e.g. `.txt`, `.pdf`, `.sh`) -> 415 Unsupported Media Type.

### Tier 3: Cross-Feature Integration Flows
- **T3.1: Full Guest Purchase Flow**:
  1. `GET /api/products` -> retrieve SPT-001.
  2. `POST /api/orders` -> place guest order with custom Spotify details -> Status `PENDING_PAYMENT`.
  3. `POST /api/payments/create-order` -> create Razorpay order for ₹699.
  4. `POST /api/payments/verify` -> submit valid HMAC signature -> Status becomes `ORDER_RECEIVED`.
  5. `GET /api/orders/track?orderNumber=...&email=...` -> verify live timeline reflects `ORDER_RECEIVED`.
- **T3.2: Customer Registration & Dashboard Flow**:
  1. `POST /api/auth/register` -> register customer.
  2. `POST /api/orders` (authenticated) -> place order.
  3. `POST /api/payments/verify` -> complete payment.
  4. `GET /api/orders/my-orders` -> verify new order appears in customer's order history with customization details.
- **T3.3: Admin Product & Order Fulfillment Flow**:
  1. `POST /api/auth/admin/login` -> obtain admin JWT.
  2. `POST /api/products` (multipart) -> upload new keychain product.
  3. `GET /api/products` -> verify new product appears immediately in catalog.
  4. `GET /api/admin/orders` -> locate paid order.
  5. `PATCH /api/admin/orders/:id/status` -> change status `ORDER_RECEIVED` -> `ENGRAVING`.
  6. `PATCH /api/admin/orders/:id/status` -> change status `ENGRAVING` -> `DISPATCHED` (with tracking number `BD-123456`).
  7. `GET /api/orders/track` -> verify customer sees `DISPATCHED` and tracking number `BD-123456`.
  8. `PATCH /api/admin/orders/:id/status` -> change status `DISPATCHED` -> `DELIVERED`.

### Tier 4: Real-World Scenarios & Resiliency
- **T4.1: Server Crash / Restart Resilience**:
  - Place orders -> restart Node.js server -> query `/api/orders/track` -> verify all data, customization, and statuses persist cleanly in SQLite DB.
- **T4.2: Webhook Asynchronous Capture & Idempotency**:
  - Place order -> simulate Razorpay `payment.captured` webhook -> verify order updates to `ORDER_RECEIVED`.
  - Re-send exact same webhook -> verify 200 OK and no corrupted state.
- **T4.3: Concurrency & Load Stress**:
  - Run 20 concurrent order placement requests in parallel -> verify unique order numbers and zero duplicate keys or DB lock errors.
- **T4.4: Frontend Fallback**:
  - Simulate backend offline -> verify `index.html` loads fallback static product cards without UI breakage.

---

## 9. Next Steps for Implementation Team

1. **Milestone 1**: Initialize `package.json` with dependencies (`express`, `better-sqlite3` or `sqlite3`, `bcryptjs`, `jsonwebtoken`, `multer`, `cors`, `dotenv`, `razorpay`), setup server entry `server.js`, and database schema migration runner.
2. **Milestone 2**: Implement Authentication system (`/api/auth/*`), JWT middleware, and role guards (`customer`, `admin`).
3. **Milestone 3**: Implement Product catalog routes (`/api/products/*`), Multer file upload pipeline (`/uploads`), and connect dynamic hydration into `index.html`.
4. **Milestone 4**: Implement Custom ordering engine (`/api/orders/*`), Spotify validation, and Razorpay payment workflow (`/api/payments/*`) with HMAC verification and mock mode.
5. **Milestone 5**: Build Customer Dashboard (`dashboard.html` / `/dashboard`) with order history and tracking timeline.
6. **Milestone 6**: Build Developer Admin Portal (`admin.html` / `/admin`) with product manager, stock toggle, and order status fulfillment updater.
7. **Final Verification**: Run comprehensive test suites across Tier 1 to Tier 4, verifying 100% pass rate.
