# Original User Request

## Initial Request — 2026-08-17T14:00:07Z

Build a complete Node.js + Express backend server with database storage, Razorpay payment gateway integration, Email + Google OAuth 2.0 customer authentication, order tracking, and a developer-only admin portal for TuneTagZ.

Working directory: k:\projects\tunetags
Integrity mode: development

## Requirements

### R1. Node.js + Express Backend & Database
- Build a Node.js + Express REST API server inside `k:\projects\tunetags`.
- Database (SQLite / PostgreSQL) to store users, products, custom orders (Spotify song link/code, custom text), and payment transactions.

### R2. Customer Authentication (Email/Password + Google OAuth 2.0)
- Customer sign-up/login via Email + Password and Google OAuth 2.0.
- Secure JWT/session tokens for authenticating requests.

### R3. Payment Gateway Integration (Razorpay)
- Integrate Razorpay API for processing Indian payments (UPI, Cards, Netbanking).
- Server-side order creation, payment signature verification, and webhook handling.

### R4. Customer Dashboard & Order Tracking
- Customer portal where users can log in, view order history, see customization details (Spotify code/song name), and track live order status (e.g. Received, Engraving, Dispatched, Delivered).

### R5. Developer Admin Portal & Instant Product Sync
- Protected developer admin panel (`/admin` or `admin.html`) requiring developer admin authentication.
- Upload product images to local `/uploads` folder using `multer`, set prices, edit descriptions, toggle stock availability, and update customer order fulfillment statuses.
- Dynamic frontend sync: `index.html` dynamically fetches products from `/api/products` so newly uploaded products appear immediately on the website.

## Acceptance Criteria

### Backend & Database Infrastructure
- [ ] Express server starts cleanly with structured routes (`/api/auth`, `/api/products`, `/api/orders`, `/api/payments`).
- [ ] Database schema tracks users, products, orders, and payment statuses securely.

### Customer Authentication & Tracking
- [ ] Email/Password and Google OAuth 2.0 sign-in endpoints work end-to-end.
- [ ] Customers can view their active and past orders with live status updates.

### Payment Processing
- [ ] Checkout flow generates Razorpay Order IDs and verifies payment signatures server-side.

### Admin Portal & Instant Product Sync
- [ ] Developer admin portal allows uploading new products with image files saved to `/uploads`.
- [ ] Newly created or updated products dynamically render on `index.html` without manual HTML editing.
- [ ] Admin can view customer orders and update fulfillment status.
