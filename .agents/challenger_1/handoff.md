# Challenger 1: Adversarial Empirical & Concurrency Verification Report

- **Author**: Challenger 1 (Adversarial Empirical Verifier & Concurrency Tester)
- **Role**: Critic & Specialist
- **Workspace**: `k:\projects\tunetags`
- **Working Directory**: `k:\projects\tunetags\.agents\challenger_1`
- **Execution Script**: `node .agents/challenger_1/stress_test.js`
- **Verdict**: **`REQUEST_CHANGES`** (3/4 Scenarios Passed, 1 Validation Defect Found)
- **Timestamp**: 2026-08-17T14:24:00Z

---

## 1. Observation

Adversarial stress and concurrency testing was conducted by executing `node .agents/challenger_1/stress_test.js` against the live backend server. A total of **57 empirical adversarial assertions** across 4 major threat vectors were evaluated.

### 1.1 Scenario 1: High Concurrency (20 Parallel Lifecycles)
- **Test Command**: `node .agents/challenger_1/stress_test.js`
- **Workload**: 20 simultaneous customer registrations, followed by parallel custom order placements (`SPT-001` @ ₹699), Razorpay order creations, HMAC-SHA256 signature verifications, and live tracking queries (100 total HTTP requests).
- **Observed Metrics**:
  - Simultaneous lifecycles completed: `20/20` (100% success rate)
  - Order numbers generated: `20` unique order numbers (`Set.size === 20`, 0 collisions)
  - Order state transition: `20/20` reached `status: 'ORDER_RECEIVED'` and `payment_status: 'PAID'`
  - Database lock contention: `0` `SQLITE_BUSY` or lock timeout errors
  - Pricing integrity: `20/20` orders charged exactly `₹699.00`
  - Latencies: `min = 35.79ms`, `mean = 556.52ms`, `p50 = 112.36ms`, `p90 = 1845.50ms`, `p95 = 2187.59ms`, `max = 2447.38ms`

### 1.2 Scenario 2: Price Manipulation & Quantity Tampering
- **Observed Behaviors**:
  - `price: 0 injection` $\rightarrow$ Server calculated DB price `totalAmount: 699` (Passed)
  - `price: 1 injection (₹1 scam)` $\rightarrow$ Server calculated DB price `totalAmount: 699` (Passed)
  - `price: -100 injection` $\rightarrow$ Server calculated DB price `totalAmount: 699` (Passed)
  - `price: null injection` $\rightarrow$ Server calculated DB price `totalAmount: 699` (Passed)
  - `price: 'free' NaN injection` $\rightarrow$ Server calculated DB price `totalAmount: 699` (Passed)
  - `/api/orders/calculate with tampered items` $\rightarrow$ Returned `totalAmount: 699` (Passed)
  - `quantity: -5` $\rightarrow$ HTTP 400 rejection (Passed)
  - `quantity: 'five'` $\rightarrow$ HTTP 400 rejection (Passed)
  - `quantity: 0.5` $\rightarrow$ HTTP 400 rejection (Passed)
  - `empty items []` $\rightarrow$ HTTP 400 rejection (Passed)
  - `SQL Injection (DROP TABLE, UNION SELECT, OR 1=1)` $\rightarrow$ Safely escaped via SQLite parameterized queries (Passed)
  - `Bit-flipped HMAC-SHA256 signature` $\rightarrow$ HTTP 400 rejection (Passed)
  - **DEFECT OBSERVED**:
    ```
    [FAIL] quantity: 0 (falsy default bypass) -> Status: 201, Total: ₹N/A
    ```
    - File: `k:\projects\tunetags\src\services\order.service.js:31` and `k:\projects\tunetags\src\services\order.service.js:183`
    - Verbatim Code (`order.service.js:31`):
      ```javascript
      const quantity = parseInt(item.quantity || 1, 10);
      ```
    - Verbatim Code (`order.service.js:183`):
      ```javascript
      const rawItems = orderData.items || (orderData.productId ? [{ productId: orderData.productId, quantity: orderData.quantity || 1, customization: orderData.customization }] : []);
      ```
    - Result: When a client submits `{ productId: 1, quantity: 0 }`, JavaScript evaluates `0 || 1` as `1`. The quantity is coerced to `1`, bypassing the `if (isNaN(quantity) || quantity < 1)` boundary check in line 39. The order is placed and charged as 1 unit instead of returning `HTTP 400 Bad Request`.

### 1.3 Scenario 3: Order State Machine Violations & RBAC Guards
- **Observed Behaviors**:
  - `PATCH /api/admin/orders/:id/status` (Unauthenticated) $\rightarrow$ Verbatim response: `HTTP 401 Authentication required. No token provided.`
  - `PATCH /api/admin/orders/:id/status` (Customer token) $\rightarrow$ Verbatim response: `HTTP 403 Forbidden: Developer administrator privileges required.`
  - `Illegal transition: PENDING_PAYMENT -> DELIVERED` $\rightarrow$ Verbatim response: `HTTP 400 Invalid state transition from 'PENDING_PAYMENT' to 'DELIVERED'.`
  - `Illegal transition: PENDING_PAYMENT -> QUALITY_CHECK` $\rightarrow$ Verbatim response: `HTTP 400 Invalid state transition from 'PENDING_PAYMENT' to 'QUALITY_CHECK'.`
  - `Valid lifecycle (PENDING_PAYMENT -> ORDER_RECEIVED -> ENGRAVING -> QUALITY_CHECK -> DISPATCHED -> DELIVERED)` $\rightarrow$ Succeeded with `HTTP 200`.
  - `Illegal backwards transition: DELIVERED -> ORDER_RECEIVED` $\rightarrow$ Verbatim response: `HTTP 400 Invalid state transition from 'DELIVERED' to 'ORDER_RECEIVED'.`
  - `Illegal transition: DELIVERED -> CANCELLED` $\rightarrow$ Verbatim response: `HTTP 400 Invalid state transition from 'DELIVERED' to 'CANCELLED'.`

### 1.4 Scenario 4: Spotify Parser Fuzzing, XSS & Input Boundaries
- **Observed Behaviors**:
  - Missing query parameter on `GET /api/spotify/preview` $\rightarrow$ `HTTP 400`
  - 6 malformed URL variations (non-Spotify URLs, search queries, truncated/oversized IDs) $\rightarrow$ Handled gracefully with `{ isValid: false }` without 500 crashes
  - 4 valid Spotify formats (Track URL, Web URI, Album URL, 22-char ID) $\rightarrow$ Returned `{ isValid: true }` and generated SVG soundwaves
  - Custom text boundary `30 characters` $\rightarrow$ Accepted (`HTTP 201`)
  - Custom text boundary `31 characters` $\rightarrow$ Rejected (`HTTP 400 Custom engraving text must not exceed 30 characters.`)
  - Buffer overflow attempt `10,000 characters` $\rightarrow$ Rejected (`HTTP 400`)
  - XSS injection (`<script>`, `<svg onload>`, `<img onerror>`) $\rightarrow$ Angle brackets sanitized and stripped across custom text, song metadata, and notes fields.

---

## 2. Logic Chain

1. **Premise 1 (Concurrency & Data Integrity)**: SQLite with WAL mode (`PRAGMA journal_mode = WAL;`) and transactional blocks (`db.transaction()`) in `src/config/database.js` and `src/services/order.service.js` successfully supported 20 simultaneous customer checkouts without deadlocks, lost updates, or ID collisions.
2. **Premise 2 (State Machine & RBAC Integrity)**: State transition matrix (`ALLOWED_TRANSITIONS` in `src/services/admin.service.js:7-17`) and RBAC guards (`requireAdmin` in `src/middleware/adminAuth.js`) strictly prevent unauthenticated, customer-escalated, out-of-order, or post-delivery mutations.
3. **Premise 3 (Parser & Sanitization Robustness)**: `parseSpotifyUrl` and `validateCustomText` in `src/services/spotify.service.js` enforce 30-character limits and sanitize HTML markup effectively.
4. **Premise 4 (Quantity Validation Bypass Bug)**:
   - In JavaScript, `0` is a falsy primitive.
   - The expression `item.quantity || 1` in `src/services/order.service.js:31` resolves `0 || 1` to `1`.
   - Consequently, `quantity` is assigned `1` instead of `0`.
   - The subsequent validation check `if (isNaN(quantity) || quantity < 1)` evaluates `1 < 1` as `false` and allows the request through.
   - This causes an explicit `quantity: 0` payload to create a billable order for 1 item rather than rejecting the invalid quantity with HTTP 400.

---

## 3. Caveats

- **Mock Payment Mode**: Tests were run with `MOCK_PAYMENTS=true` to test deterministic HMAC cryptographic verification offline without hitting live Razorpay banking rails. Live Razorpay API network latency was not benchmarked.
- **Single-Node Execution**: Testing was executed on a single host. Distributed clustering over shared NFS was not in scope per project specifications (single SQLite database).

---

## 4. Conclusion

**Verdict**: **`REQUEST_CHANGES`**

While 3 of the 4 challenge areas (High Concurrency, State Machine Enforcement, and Spotify Fuzzing/XSS) are rock-solid, a specific input validation defect in `src/services/order.service.js` was empirically discovered and reproduced.

### Recommended Fix:
In `src/services/order.service.js`:
- **Line 31**: Replace:
  ```javascript
  const quantity = parseInt(item.quantity || 1, 10);
  ```
  with:
  ```javascript
  const quantity = parseInt(item.quantity !== undefined && item.quantity !== null ? item.quantity : 1, 10);
  ```
- **Line 183**: Replace:
  ```javascript
  const rawItems = orderData.items || (orderData.productId ? [{ productId: orderData.productId, quantity: orderData.quantity || 1, customization: orderData.customization }] : []);
  ```
  with:
  ```javascript
  const rawItems = orderData.items || (orderData.productId ? [{ productId: orderData.productId, quantity: orderData.quantity !== undefined && orderData.quantity !== null ? orderData.quantity : 1, customization: orderData.customization }] : []);
  ```

---

## 5. Verification Method

To independently reproduce and verify this finding:

1. Run the empirical stress test script:
   ```bash
   node .agents/challenger_1/stress_test.js
   ```
2. Observe the failed assertion under Scenario 2:
   ```
   [FAIL] quantity: 0 (falsy default bypass) -> Status: 201, Total: ₹N/A
   ```
3. Send a standalone HTTP request:
   ```bash
   node -e "fetch('http://localhost:3000/api/orders', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ items: [{ productId: 1, quantity: 0 }], customer: { name: 'Bug Demo', email: 'bug@test.com', phone: '+919876543210' }, shippingAddress: { line1: '123 St', city: 'Delhi', state: 'Delhi', postalCode: '110001' } }) }).then(r=>console.log('Status:', r.status))"
   ```
4. **Invalidation Condition**: Once the fix is applied, the request will return `Status: 400` with `Invalid quantity (0) for product ID 1. Must be at least 1.`, and `node .agents/challenger_1/stress_test.js` will return `VERDICT: APPROVE` (Exit Code 0).
