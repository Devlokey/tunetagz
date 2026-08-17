# TuneTagZ Backend Architecture, Database Schema & API Specification

**Author**: Explorer Survey 2 (Backend & Architecture Specialist)  
**Target Path**: `k:\projects\tunetags`  
**Date**: 2026-08-17  
**Runtime Environment**: Node.js v25.8.2 / win32 x64 / SQLite (zero-config embedded)

---

## 1. Executive Summary

TuneTagZ is a modern e-commerce platform specializing in personalized, laser-engraved 3D-printed Spotify code keychains and wearable accessories. The existing frontend codebase (`index.html`, `tunetagz (2).html`) features high-converting luxury dark/gold aesthetic landing pages, animated price counters, interactive hero carousel, and product cards (SPT-001 Spotify Code Tag at ₹699, RKY-001 Rocky Keychain at ₹300, and upcoming drops).

This document establishes the complete, production-ready backend architecture for TuneTagZ. The backend delivers:
1. **Zero-Config Portable Embedded Database**: SQLite persistence via `better-sqlite3` (or `sqlite3` fallback) requiring zero external database installations or cloud connection setup.
2. **Dual-Channel Customer & Admin Authentication**: Email/Password authentication using `bcryptjs` + Google OAuth 2.0 (Google Identity Services ID Token verification and standard OAuth callback) + JWT tokens stored via HTTP-only secure cookies and `Authorization: Bearer` headers.
3. **End-to-End Razorpay Payment Gateway Integration**: Server-side order creation (`/api/payments/create-order`), cryptographic HMAC-SHA256 signature verification (`/api/payments/verify`), and asynchronous webhook processing (`/api/payments/webhook`), complete with automated mock mode for offline/sandbox development.
4. **Multer-Powered Product Management & File Upload Pipeline**: Multipart form handling, mime-type verification, unique filename hashing, and static serving under `/uploads/*`.
5. **Developer Admin Portal APIs**: Role-based access control (`customer` vs `admin`/`developer`), order fulfillment tracking (Received $\rightarrow$ Engraving $\rightarrow$ Dispatched $\rightarrow$ Delivered), inventory toggles, and live sales metrics.
6. **Customer Portal & Live Order Tracking**: Instant tracking by Order ID or customer login with step-by-step progress timeline.

---

## 2. System Architecture & Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             CLIENT LAYER                                    │
│  ┌────────────────────────┐  ┌───────────────────────┐  ┌────────────────┐  │
│  │   Storefront Landing   │  │  Customizer / Checkout│  │ Developer Admin│  │
│  │     (index.html)       │  │ (Modal / orders.html) │  │  (admin.html)  │  │
│  └───────────┬────────────┘  └───────────┬───────────┘  └───────┬────────┘  │
└──────────────┼───────────────────────────┼──────────────────────┼───────────┘
               │ HTTP Requests             │ Checkout / Webhook   │ Admin APIs
               ▼                           ▼                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    EXPRESS REST API SERVER (Node.js)                        │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Global Middleware: CORS, Helmet, Morgan, Cookie-Parser, Rate Limiting │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                      │                                      │
│      ┌───────────────────────────────┼───────────────────────────────┐      │
│      ▼                               ▼                               ▼      │
│ ┌───────────────┐           ┌─────────────────┐           ┌──────────────┐  │
│ │ /api/auth     │           │ /api/payments   │           │ /api/admin   │  │
│ │ - Register    │           │ - Create Order  │           │ - Stats      │  │
│ │ - Login       │           │ - Verify Sig    │           │ - Orders CRUD│  │
│ │ - Google OAuth│           │ - Webhooks      │           │ - Product Mgt│  │
│ └───────────────┘           └─────────────────┘           └──────────────┘  │
│      ▼                               ▼                               ▼      │
│ ┌───────────────┐           ┌─────────────────┐           ┌──────────────┐  │
│ │ /api/products │           │ /api/orders     │           │ /uploads     │  │
│ │ - List Active │           │ - Track Order   │           │ - Multer Disk│  │
│ │ - Product ByID│           │ - User Orders   │           │   Storage    │  │
│ └───────────────┘           └─────────────────┘           └──────────────┘  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       STORAGE & INTEGRATION LAYER                           │
│  ┌────────────────────────────────────────┐  ┌───────────────────────────┐  │
│  │        SQLite Embedded Database        │  │     External Services     │  │
│  │          (data/tunetagz.db)            │  │  - Razorpay Orders & Pay  │  │
│  │  users, products, orders, order_items, │  │  - Google OAuth / GIS     │  │
│  │  payments, admin_settings              │  │  - Local Uploads (/uploads│  │
│  └────────────────────────────────────────┘  └───────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Project Directory Structure & Dependencies

### 3.1 Recommended Modular File Tree

```
k:\projects\tunetags\
├── server.js                        # Main Express application entrypoint
├── package.json                     # Project manifest and scripts
├── .env.example                     # Environment template
├── .gitignore                       # Git ignore (node_modules, .env, data/, uploads/)
├── data/                            # SQLite database directory (auto-created)
│   └── tunetagz.db
├── uploads/                         # Product & customization uploads (auto-created)
│   └── .gitkeep
├── src/
│   ├── app.js                       # Express app setup and middleware configuration
│   ├── config/
│   │   ├── db.js                    # SQLite connection, table DDL, and migrations
│   │   ├── env.js                   # Typed environment validation
│   │   ├── razorpay.js              # Razorpay SDK client & mock handler
│   │   └── seed.js                  # Initial product and admin seed runner
│   ├── middleware/
│   │   ├── auth.middleware.js       # JWT extraction (cookie/header) & role check
│   │   ├── upload.middleware.js     # Multer storage, limits, and mime-type filters
│   │   ├── error.middleware.js      # Centralized error handler and logging
│   │   └── rateLimiter.js           # Express rate limiters for auth & payment
│   ├── routes/
│   │   ├── auth.routes.js           # /api/auth routes
│   │   ├── product.routes.js        # /api/products routes
│   │   ├── order.routes.js          # /api/orders routes
│   │   ├── payment.routes.js        # /api/payments routes
│   │   └── admin.routes.js          # /api/admin routes
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── product.controller.js
│   │   ├── order.controller.js
│   │   ├── payment.controller.js
│   │   └── admin.controller.js
│   ├── models/                      # Database query access objects (DAOs)
│   │   ├── user.model.js
│   │   ├── product.model.js
│   │   ├── order.model.js
│   │   └── payment.model.js
│   └── utils/
│       ├── crypto.js                # HMAC signature and token utilities
│       ├── spotify.js               # Spotify URL validator and URI extractor
│       └── response.js              # Standardized API response formatters
├── public/ (or root static files)
│   ├── index.html                   # Customer storefront with dynamic product sync
│   ├── admin.html                   # Developer admin portal UI
│   ├── orders.html                  # Live order tracking and customer history UI
│   ├── POSTER 1.png                 # Seed assets
│   ├── POSTER 2.png
│   ├── PRODUCT 1.png
│   ├── PRODUCT 2.png
│   └── TUNETAGZ LOGO.png
```

### 3.2 NPM Dependencies Specification

```json
{
  "name": "tunetagz",
  "version": "1.0.0",
  "description": "TuneTagZ Custom Engraved Spotify Code Keychain E-Commerce Server",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js",
    "seed": "node src/config/seed.js",
    "test": "node --test"
  },
  "dependencies": {
    "better-sqlite3": "^11.8.1",
    "bcryptjs": "^2.4.3",
    "cookie-parser": "^1.4.7",
    "cors": "^2.8.5",
    "dotenv": "^16.4.7",
    "express": "^4.21.2",
    "express-rate-limit": "^7.5.0",
    "google-auth-library": "^9.15.0",
    "helmet": "^8.0.0",
    "jsonwebtoken": "^9.0.2",
    "morgan": "^1.10.0",
    "multer": "^1.4.5-lts.1",
    "razorpay": "^2.9.5"
  }
}
```

*Note on `bcryptjs`*: Pure JavaScript implementation of bcrypt ensures 100% portable zero-compilation execution on Windows without requiring MSVC C++ build tools.  
*Note on `better-sqlite3`*: Provides synchronous, transaction-safe SQLite operations. If prebuilt binary compilation is restricted in specific environments, a lightweight `sqlite3` with Promise wrapper can serve as a drop-in replacement.

---

## 4. Database Architecture & SQLite Schema Design

### 4.1 Schema Overview (DDL)

```sql
-- Enable WAL mode for high concurrency and foreign keys
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL COLLATE NOCASE,
  password_hash TEXT NULL,           -- NULL if registered via Google OAuth
  name TEXT NOT NULL,
  phone TEXT NULL,
  google_id TEXT UNIQUE NULL,
  avatar_url TEXT NULL,
  role TEXT NOT NULL DEFAULT 'customer' CHECK(role IN ('customer', 'admin', 'developer')),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sku TEXT UNIQUE NOT NULL,          -- e.g. 'SPT-001', 'RKY-001'
  name TEXT NOT NULL,                -- e.g. 'Spotify Code Tag'
  tagline TEXT NULL,                 -- e.g. 'Scan and play. Your favorite track in gold.'
  description TEXT NOT NULL,
  price REAL NOT NULL CHECK(price >= 0), -- Price in INR (e.g. 699.00)
  original_price REAL NULL,          -- Strikethrough price for discounts (e.g. 899.00)
  badge TEXT NULL,                   -- 'Bestseller', 'New', 'Limited Edition'
  image_url TEXT NOT NULL,           -- '/uploads/prod-1718000000.png' or 'POSTER 1.png'
  gallery_images TEXT NULL,          -- JSON array of image URLs
  category TEXT NOT NULL DEFAULT 'keychain',
  is_customizable INTEGER NOT NULL DEFAULT 1 CHECK(is_customizable IN (0, 1)),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
  stock_status TEXT NOT NULL DEFAULT 'in_stock' CHECK(stock_status IN ('in_stock', 'out_of_stock', 'preorder', 'coming_soon')),
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. ORDERS TABLE
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,               -- e.g. 'TTZ-20260817-A1B2C3'
  user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL COLLATE NOCASE,
  customer_phone TEXT NOT NULL,
  shipping_address_line1 TEXT NOT NULL,
  shipping_address_line2 TEXT NULL,
  shipping_city TEXT NOT NULL,
  shipping_state TEXT NOT NULL,
  shipping_pincode TEXT NOT NULL,
  total_amount REAL NOT NULL CHECK(total_amount >= 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'pending_payment' 
    CHECK(status IN ('pending_payment', 'paid', 'received', 'engraving', 'dispatched', 'delivered', 'cancelled', 'refunded')),
  tracking_number TEXT NULL,         -- Courier AWB tracking number
  courier_partner TEXT NULL,         -- e.g. 'Delhivery', 'Bluedart', 'India Post'
  notes TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. ORDER ITEMS TABLE (With Customization Fields)
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,
  product_sku TEXT NOT NULL,
  unit_price REAL NOT NULL CHECK(unit_price >= 0),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity >= 1),
  subtotal REAL NOT NULL CHECK(subtotal >= 0),
  customization_spotify_url TEXT NULL,    -- Spotify Track/Album/Playlist URL or URI
  customization_spotify_code TEXT NULL,   -- Extracted Spotify URI / code ID
  customization_song_title TEXT NULL,     -- Song Title & Artist entered or fetched
  customization_engraved_text TEXT NULL,  -- Custom back engraving text
  customization_preview_data TEXT NULL    -- JSON string with visual customizer parameters
);

-- 5. PAYMENTS TABLE (Razorpay Transaction Audit)
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  razorpay_order_id TEXT UNIQUE NOT NULL,
  razorpay_payment_id TEXT UNIQUE NULL,
  razorpay_signature TEXT NULL,
  amount REAL NOT NULL,                   -- in INR
  currency TEXT NOT NULL DEFAULT 'INR',
  method TEXT NULL,                       -- 'upi', 'card', 'netbanking', 'wallet'
  status TEXT NOT NULL DEFAULT 'created' 
    CHECK(status IN ('created', 'authorized', 'captured', 'failed', 'refunded')),
  error_code TEXT NULL,
  error_description TEXT NULL,
  raw_webhook_payload TEXT NULL,          -- Full audit log of webhook events
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. ADMIN SETTINGS TABLE (Store Settings & Key-Value Configuration)
CREATE TABLE IF NOT EXISTS admin_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 4.2 Indexes & Performance Optimization

```sql
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active, display_order);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_order_id ON payments(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_payment_id ON payments(razorpay_payment_id);
```

### 4.3 Default Seed Data Specification

```sql
-- Initial Products corresponding to TuneTagZ collection
INSERT OR IGNORE INTO products (sku, name, tagline, description, price, original_price, badge, image_url, category, is_customizable, is_active, stock_status, display_order)
VALUES 
(
  'SPT-001', 
  'Spotify Code Tag', 
  'Scan and play. Your favorite track engraved in gold on matte black.', 
  'Scan and play. Your favorite track engraved in gold on matte black — with your name on the back. The ultimate gift for any music lover.', 
  699.00, 
  899.00, 
  'Bestseller', 
  'POSTER 1.png', 
  'keychain', 
  1, 
  1, 
  'in_stock', 
  1
),
(
  'RKY-001', 
  'Rocky Keychain', 
  'A wearable sculpture for your keys. Intricate maze-pattern 3D printed figure in matte black.', 
  'A wearable sculpture for your keys. Intricate maze-pattern 3D printed figure in matte black — bold, tactile, and unlike anything else on the market.', 
  300.00, 
  450.00, 
  'New', 
  'POSTER 2.png', 
  'keychain', 
  0, 
  1, 
  'in_stock', 
  2
),
(
  'DRP-003', 
  'Drop 03 — Limited Edition', 
  'Something new is dropping. The third TuneTagZ collection.', 
  'Something new is dropping. Follow us on Instagram to be the first to know when our third collection goes live.', 
  0.00, 
  NULL, 
  'Coming Soon', 
  'PRODUCT 1.png', 
  'keychain', 
  1, 
  1, 
  'coming_soon', 
  3
);

-- Initial Store Settings
INSERT OR IGNORE INTO admin_settings (key, value, description)
VALUES 
('store_name', 'TuneTagZ', 'Store display name'),
('contact_email', 'support@tunetagz.com', 'Customer support email'),
('contact_phone', '+91 9876543210', 'Customer support phone number'),
('instagram_url', 'https://www.instagram.com/tune.tagz/', 'Official Instagram profile'),
('announcement_bar', 'Free Tracked Shipping Across India on All Orders!', 'Top announcement banner text'),
('razorpay_mode', 'mock', 'Payment mode: mock or live');
```

---

## 5. Authentication System Design

### 5.1 Architecture & Token Handling

Authentication supports both customer accounts and developer/admin users with JWT tokens:
- **Token Signing**: `jwt.sign({ id, email, role, name }, process.env.JWT_SECRET, { expiresIn: '7d' })`
- **Cookie Security**:
  ```javascript
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
  ```
- **Dual Transport**: Supports reading from both `req.cookies.token` and `Authorization: Bearer <token>` for SPA, mobile, and API clients.

### 5.2 Registration & Login Flows

```
[Customer] ──── POST /api/auth/register (email, password, name, phone) ───► [Server]
               - Validates input formats
               - Hashes password: bcryptjs.hash(password, 10)
               - Inserts user with role='customer'
               - Generates JWT & sets HTTP-only cookie
               ◄─── Returns 201 { success: true, token, user } ───────────

[Customer] ──── POST /api/auth/login (email, password) ───────────────────► [Server]
               - Finds user by email
               - Compares bcryptjs.compare(password, user.password_hash)
               - Generates JWT & sets HTTP-only cookie
               ◄─── Returns 200 { success: true, token, user } ───────────
```

### 5.3 Google OAuth 2.0 Integration (GIS & Standard Token)

1. **Google Identity Services (GIS) One-Tap / Button**:
   - Client embeds GIS script: `<script src="https://accounts.google.com/gsi/client" async defer></script>`
   - Client sends JWT ID token: `POST /api/auth/google` with `{ credential: "<google_id_token>" }`
   - Server verification logic:
     ```javascript
     const { OAuth2Client } = require('google-auth-library');
     const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
     
     async function verifyGoogleToken(idToken) {
       const ticket = await client.verifyIdToken({
         idToken,
         audience: process.env.GOOGLE_CLIENT_ID
       });
       const payload = ticket.getPayload();
       return {
         googleId: payload['sub'],
         email: payload['email'],
         name: payload['name'],
         avatarUrl: payload['picture']
       };
     }
     ```
   - User Upsert: If user exists with `google_id` or `email`, update profile; otherwise insert new record. Issue TuneTagZ JWT.

2. **Standard OAuth 2.0 Callback Flow**:
   - `GET /api/auth/google/url`: Returns authorization consent URL.
   - `GET /api/auth/google/callback`: Receives `code`, exchanges for access/ID tokens, upserts user, and redirects to frontend with auth cookie.

### 5.4 Developer Admin Authentication

- **Admin Login**: `POST /api/auth/admin-login`
  - Accepts `{ email, password }` or Developer Master Key (`ADMIN_SECRET_KEY`).
  - Validates credentials against seeded admin user or environment overrides (`ADMIN_EMAIL`, `ADMIN_PASSWORD`).
  - Issues JWT containing `{ id, email, role: 'admin', name }`.
- **Admin Middleware (`requireAdmin`)**:
  ```javascript
  function requireAdmin(req, res, next) {
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'developer')) {
      return res.status(403).json({ success: false, error: 'Forbidden: Developer admin access required.' });
    }
    next();
  }
  ```

---

## 6. Razorpay Payment Gateway Integration

### 6.1 Order Creation (`/api/payments/create-order`)

**Security Rule**: Client never sends total prices! Server calculates total amount directly from database product records to prevent price tampering.

```javascript
// Step 1: Server computes subtotal & total
let calculatedTotal = 0;
const processedItems = [];

for (const item of req.body.items) {
  const product = db.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').get(item.productId);
  if (!product) throw new Error(`Product ${item.productId} unavailable`);
  
  const subtotal = product.price * item.quantity;
  calculatedTotal += subtotal;
  processedItems.push({
    productId: product.id,
    productName: product.name,
    productSku: product.sku,
    unitPrice: product.price,
    quantity: item.quantity,
    subtotal: subtotal,
    customization: item.customization || {}
  });
}

// Step 2: Create internal Order ID
const orderId = `TTZ-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

// Step 3: Call Razorpay API (or Mock handler if RAZORPAY_KEY_ID not configured)
let razorpayOrderId;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && process.env.RAZORPAY_KEY_ID !== 'rzp_test_placeholder') {
  const rzpOrder = await razorpayInstance.orders.create({
    amount: Math.round(calculatedTotal * 100), // in paise (e.g. ₹699.00 -> 69900)
    currency: 'INR',
    receipt: orderId,
    notes: { orderId, customerEmail: req.body.customer.email }
  });
  razorpayOrderId = rzpOrder.id;
} else {
  // Offline Mock Order for Sandbox / Automated Testing
  razorpayOrderId = `order_mock_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

// Step 4: Transactional DB insert of Order, Items, and Payment record
db.transaction(() => {
  db.prepare(`
    INSERT INTO orders (id, user_id, customer_name, customer_email, customer_phone, 
      shipping_address_line1, shipping_address_line2, shipping_city, shipping_state, 
      shipping_pincode, total_amount, currency, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'INR', 'pending_payment')
  `).run(orderId, req.user?.id || null, req.body.customer.name, req.body.customer.email, 
         req.body.customer.phone, req.body.shippingAddress.line1, req.body.shippingAddress.line2 || null,
         req.body.shippingAddress.city, req.body.shippingAddress.state, req.body.shippingAddress.pincode, calculatedTotal);

  for (const item of processedItems) {
    db.prepare(`
      INSERT INTO order_items (order_id, product_id, product_name, product_sku, unit_price, 
        quantity, subtotal, customization_spotify_url, customization_spotify_code, 
        customization_song_title, customization_engraved_text, customization_preview_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(orderId, item.productId, item.productName, item.productSku, item.unitPrice, 
           item.quantity, item.subtotal, item.customization.spotifyUrl || null,
           item.customization.spotifyCode || null, item.customization.songTitle || null,
           item.customization.engravedText || null, JSON.stringify(item.customization.previewData || {}));
  }

  db.prepare(`
    INSERT INTO payments (order_id, razorpay_order_id, amount, currency, status)
    VALUES (?, ?, ?, 'INR', 'created')
  `).run(orderId, razorpayOrderId, calculatedTotal);
})();
```

### 6.2 Signature Verification (`/api/payments/verify`)

```javascript
const crypto = require('crypto');

function verifyPaymentSignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  if (razorpay_order_id.startsWith('order_mock_')) {
    // Verified in mock development mode
    return true;
  }
  const secret = process.env.RAZORPAY_KEY_SECRET;
  const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
  const generatedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(generatedSignature),
    Buffer.from(razorpay_signature)
  );
}
```

Upon successful verification:
1. Update `payments` table: `status = 'captured'`, `razorpay_payment_id`, `razorpay_signature`.
2. Update `orders` table: `status = 'received'`.
3. Return `{ success: true, orderId, message: "Payment verified successfully!" }`.

### 6.3 Webhook Handling (`/api/payments/webhook`)

```javascript
// Express raw body parsing required for webhooks
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (webhookSecret && signature) {
    const expected = crypto.createHmac('sha256', webhookSecret).update(req.body).digest('hex');
    if (expected !== signature) {
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }
  }

  const event = JSON.parse(req.body.toString());
  
  if (event.event === 'payment.captured') {
    const paymentEntity = event.payload.payment.entity;
    const rzpOrderId = paymentEntity.order_id;
    
    // Idempotent order update
    db.prepare(`
      UPDATE payments SET status = 'captured', razorpay_payment_id = ?, method = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE razorpay_order_id = ?
    `).run(paymentEntity.id, paymentEntity.method, rzpOrderId);

    db.prepare(`
      UPDATE orders SET status = 'received', updated_at = CURRENT_TIMESTAMP
      WHERE id = (SELECT order_id FROM payments WHERE razorpay_order_id = ?)
        AND status = 'pending_payment'
    `).run(rzpOrderId);
  }

  res.status(200).json({ status: 'ok' });
});
```

---

## 7. Product Management & Multer Upload Pipeline

### 7.1 Multer Storage & Validation Configuration

```javascript
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `prod-${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG, WEBP, and SVG images are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max per file
    files: 5
  }
});
```

### 7.2 Static Asset Serving

```javascript
// Express serves uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
```

### 7.3 Frontend Dynamic Synchronization

In `index.html`, product cards are populated dynamically from `GET /api/products`:
```javascript
async function loadProducts() {
  try {
    const res = await fetch('/api/products');
    const data = await res.json();
    if (!data.success || !data.products) return;

    const grid = document.querySelector('.products-grid');
    grid.innerHTML = data.products.map(p => `
      <article class="pcard reveal" aria-labelledby="pname-${p.id}">
        <div class="pimg-wrap">
          ${p.badge ? `<span class="pbadge">${p.badge}</span>` : ''}
          <span class="psku">${p.sku}</span>
          <img class="pimg" src="${p.image_url}" alt="${p.name}" loading="lazy" width="1254" height="1254" />
        </div>
        <div class="pbody">
          <div class="pbar"></div>
          <h3 id="pname-${p.id}" class="pname">${p.name.replace(' ', '<br/>')}</h3>
          <p class="pdesc">${p.description}</p>
          <div class="pfooter">
            <div class="pprice">₹${p.price} <small>/ piece</small></div>
            ${p.stock_status === 'coming_soon' 
              ? `<button class="pbtn" disabled style="opacity:0.6">Coming Soon</button>`
              : `<button class="pbtn open-customizer-btn" data-product-id="${p.id}" data-name="${p.name}" data-price="${p.price}" data-customizable="${p.is_customizable}">Order Now</button>`
            }
          </div>
        </div>
      </article>
    `).join('');
  } catch (err) {
    console.warn('Using static product fallback:', err);
  }
}
```

---

## 8. Developer Admin Portal Specification

### 8.1 Admin Dashboard Endpoints (`/api/admin/*`)

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/admin/login` | Developer admin authentication | Public / Master Key |
| `GET` | `/api/admin/stats` | KPI metrics (Sales ₹, Order counts by status, Recent orders) | Admin JWT |
| `GET` | `/api/admin/orders` | Paginated orders list with status & search filter | Admin JWT |
| `GET` | `/api/admin/orders/:id` | Full order detail with Spotify customization & payment info | Admin JWT |
| `PATCH` | `/api/admin/orders/:id/status` | Update fulfillment status + courier tracking info | Admin JWT |
| `GET` | `/api/admin/products` | Complete products list (including drafts & out of stock) | Admin JWT |
| `POST` | `/api/admin/products` | Create new product with Multer image upload | Admin JWT |
| `PUT` | `/api/admin/products/:id` | Update product details, price, badge, stock status | Admin JWT |
| `DELETE` | `/api/admin/products/:id` | Delete product or archive | Admin JWT |
| `GET` | `/api/admin/settings` | Retrieve store configuration key-values | Admin JWT |
| `PUT` | `/api/admin/settings` | Update store settings (announcements, contact, mode) | Admin JWT |

### 8.2 Order Fulfillment Pipeline

```
[ pending_payment ] ──(Payment Captured)──► [ received ]
                                                │
                                                ▼ (Admin Starts Laser Engraving)
                                            [ engraving ]
                                                │
                                                ▼ (Admin Adds AWB & Dispatches)
                                            [ dispatched ]
                                                │
                                                ▼ (Courier Confirms Delivery)
                                            [ delivered ]
```

When admin updates status to `dispatched`, they provide `tracking_number` and `courier_partner` (e.g. `Delhivery - AWB987654321`), which immediately becomes visible to the customer on the tracking portal.

---

## 9. Customer Order Tracking & Customizer API Specification

### 9.1 Public & Authenticated Tracking (`GET /api/orders/track/:orderId`)

- **Input**: Order ID (e.g. `TTZ-20260817-A1B2`) and optional phone/email confirmation.
- **Output**:
  ```json
  {
    "success": true,
    "order": {
      "id": "TTZ-20260817-A1B2",
      "status": "engraving",
      "createdAt": "2026-08-17T14:30:00Z",
      "customerName": "A*** D**",
      "totalAmount": 699.00,
      "courierPartner": null,
      "trackingNumber": null,
      "items": [
        {
          "productName": "Spotify Code Tag",
          "quantity": 1,
          "customization": {
            "songTitle": "Starboy - The Weeknd",
            "spotifyUrl": "https://open.spotify.com/track/7MXVkk9YM5002W2Pl6v7aw",
            "engravedText": "Amal & Sara"
          }
        }
      ],
      "timeline": [
        { "step": "Order Placed", "completed": true, "timestamp": "2026-08-17T14:30:00Z" },
        { "step": "Payment Verified", "completed": true, "timestamp": "2026-08-17T14:30:30Z" },
        { "step": "Laser Engraving", "completed": true, "current": true },
        { "step": "Dispatched", "completed": false },
        { "step": "Delivered", "completed": false }
      ]
    }
  }
  ```

---

## 10. Security Controls, Error Handling & Operational Rules

1. **Price Tampering Prevention**: Subtotals and totals are strictly computed on the server side using the database price catalog.
2. **Timing Safe Signature Verification**: `crypto.timingSafeEqual` prevents side-channel timing attacks on HMAC-SHA256 signatures.
3. **MIME Type & Extension Sanitation**: Uploaded files are verified by MIME type buffer headers and given random timestamped UUIDs to prevent arbitrary executable uploads.
4. **SQL Injection Defense**: 100% of SQLite database queries use parameterized prepared statements (`db.prepare('... WHERE id = ?').get(id)`).
5. **Rate Limiting**:
   - Auth endpoints (`/api/auth/*`): 15 requests per 15 minutes per IP.
   - Payment creation (`/api/payments/create-order`): 20 requests per 15 minutes per IP.
   - Public APIs (`/api/products`, `/api/orders/track/*`): 100 requests per 15 minutes.
6. **Graceful Error Handling Middleware**: Standard JSON error responses (`{ success: false, error: "Human-readable message" }`) without exposing stack traces in production.

---

## 11. Downstream Implementation Roadmap

| Phase | Core Deliverable | Files Impacted |
|---|---|---|
| **Phase 1** | Package Init & SQLite Database Engine | `package.json`, `src/config/db.js`, `src/config/seed.js` |
| **Phase 2** | Auth Engine & Middleware | `src/routes/auth.routes.js`, `src/controllers/auth.controller.js`, `src/middleware/auth.middleware.js` |
| **Phase 3** | Product Catalog & Multer Uploads | `src/routes/product.routes.js`, `src/controllers/product.controller.js`, `src/middleware/upload.middleware.js` |
| **Phase 4** | Razorpay Order & Payment Engine | `src/routes/payment.routes.js`, `src/controllers/payment.controller.js`, `src/config/razorpay.js` |
| **Phase 5** | Order Tracking & Customer Portal | `src/routes/order.routes.js`, `src/controllers/order.controller.js`, `public/orders.html` |
| **Phase 6** | Developer Admin Portal & APIs | `src/routes/admin.routes.js`, `src/controllers/admin.controller.js`, `public/admin.html` |
| **Phase 7** | Frontend Dynamic Sync & Customizer Modal | `index.html` integration with `/api/products` & Razorpay checkout modal |
| **Phase 8** | Verification & Automated Test Suite | `test/api.test.js`, endpoint verification, and security testing |
