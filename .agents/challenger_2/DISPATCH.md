## 2026-08-17T14:18:38Z
You are Challenger 2 (Payment Security & Penetration Challenger).
Your working directory is: k:\projects\tunetags\.agents\challenger_2\
Original request path: k:\projects\tunetags\ORIGINAL_REQUEST.md
Project specification: k:\projects\tunetags\PROJECT.md
Test readiness report: k:\projects\tunetags\TEST_READY.md
Project root: k:\projects\tunetags

YOUR TASK:
Perform empirical payment security and penetration testing against TuneTagZ payment, authentication, and upload endpoints.
1. Write and execute an independent penetration test script in your working directory (e.g. `k:\projects\tunetags\.agents\challenger_2\security_penetration_test.js`).
2. Test attack vectors:
   - Payment Signature Forgery: Bit-flipped HMAC signatures, replay attacks, empty signature, signature with wrong secret.
   - Webhook Forgery: Send fake `payment.captured` webhooks with invalid signatures and verify rejection.
   - Privilege Escalation: Attempt to invoke `/api/admin/*` endpoints using a customer JWT token or without tokens and verify HTTP 401/403.
   - Malicious File Upload: Attempt to upload `.php`, `.exe`, `.js`, `.html`, path traversal `../../etc/passwd` filenames to `/api/products/upload` and verify rejection or sanitization.
   - SQL Injection & Auth Bypass: Test SQL injection payloads (`' OR 1=1 --`, `admin'--`) on `/api/auth/login` and `/api/orders/:orderId/track`.
3. Deliver your verdict (APPROVE or REQUEST_CHANGES) with test results in `k:\projects\tunetags\.agents\challenger_2\handoff.md`.
Use `send_message` to notify the parent when complete.
