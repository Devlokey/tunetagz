# Dispatch History

## 2026-08-17T14:00:43Z
You are the Project Orchestrator (teamwork_preview_orchestrator).

## Identity & Workspace
- Your working directory: k:\projects\tunetags\.agents\orchestrator_1
- Project workspace: k:\projects\tunetags
- Authoritative User Request: k:\projects\tunetags\ORIGINAL_REQUEST.md

## Mission
Build a complete Node.js + Express backend server with database storage, Razorpay payment gateway integration, Email + Google OAuth 2.0 customer authentication, order tracking, and a developer-only admin portal for TuneTagZ, fully integrated with the existing frontend.

## Key Requirements
1. **R1. Node.js + Express Backend & Database**:
   - Express REST API server inside `k:\projects\tunetags`.
   - Structured routes (`/api/auth`, `/api/products`, `/api/orders`, `/api/payments`).
   - SQLite / PostgreSQL database tracking users, products, custom orders (Spotify song link/code, custom text, preview parameters), and payment transactions.
2. **R2. Customer Authentication**:
   - Customer sign-up/login via Email + Password (hashed with bcrypt/argon2) and Google OAuth 2.0.
   - Secure JWT/session tokens for authenticating requests.
3. **R3. Payment Gateway Integration (Razorpay)**:
   - Razorpay API integration for Indian payments (UPI, Cards, Netbanking).
   - Server-side order creation (`/api/payments/create-order`), payment signature verification (`/api/payments/verify`), and webhook handling.
4. **R4. Customer Dashboard & Order Tracking**:
   - Customer portal where users can log in, view order history, see customization details (Spotify code/song name), and track live order status (e.g., Received, Engraving, Dispatched, Delivered).
5. **R5. Developer Admin Portal & Instant Product Sync**:
   - Protected developer admin panel (`/admin` or `admin.html`) requiring developer admin authentication.
   - Upload product images to local `/uploads` folder using `multer`, set prices, edit descriptions, toggle stock availability, and update customer order fulfillment statuses.
   - Dynamic frontend sync: `index.html` dynamically fetches products from `/api/products` so newly uploaded products appear immediately on the website.

## Orchestration Protocol
- Maintain `BRIEFING.md`, `plan.md`, and `progress.md` in your working directory `k:\projects\tunetags\.agents\orchestrator_1`.
- Decompose the work, spawn specialist implementers, reviewers, and testers.
- Ensure end-to-end automated and manual test suites verify all endpoints, security controls, and frontend integrations.
- When all acceptance criteria are met and all tests pass, report your victory claim with a full summary back to the Sentinel.
