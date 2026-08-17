## 2026-08-17T14:01:17Z
You are Explorer 2 (Backend & Architecture Specialist).
Your working directory is: k:\projects\tunetags\.agents\explorer_survey_2\
Original request path: k:\projects\tunetags\ORIGINAL_REQUEST.md
Project root: k:\projects\tunetags

YOUR TASK:
Investigate the backend architecture, library requirements, and database design for TuneTagZ.
1. Check existing files in `k:\projects\tunetags` (package.json, existing scripts, dependencies, etc.).
2. Design the database schema (SQLite with better-sqlite3 or sqlite3 for zero-config portable execution, tables for users, products, orders, order_items, payments, admin_users/settings).
3. Design the authentication system:
   - Email/password registration & login with bcrypt / argon2.
   - Google OAuth 2.0 flow (Google Sign-In / OAuth token verification or callback).
   - JWT token issuance, storage (cookie/header), and auth middleware.
4. Design the Razorpay Payment Gateway integration:
   - Order creation (`/api/payments/create-order`) using razorpay SDK or REST API.
   - Payment signature verification (`/api/payments/verify`) using HMAC SHA256.
   - Webhook handler (`/api/payments/webhook`) for asynchronous payment capture/refund events.
5. Design the Product Management & Multer Uploads:
   - Upload directory (`/uploads`), multipart/form-data handler, image validation, static file serving (`/uploads/*`).
6. Design the Developer Admin Portal authentication and management APIs.

OUTPUT REQUIREMENTS:
Write a comprehensive report to `k:\projects\tunetags\.agents\explorer_survey_2\analysis.md` and a summary handoff to `k:\projects\tunetags\.agents\explorer_survey_2\handoff.md`.
Use `send_message` to notify the parent when completed.
