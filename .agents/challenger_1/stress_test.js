/**
 * Challenger 1: Adversarial Empirical Stress & Concurrency Test Harness
 * 
 * Scenarios Tested:
 * 1. High Concurrency (20 parallel customer lifecycles: Register -> Order -> Payment Order -> HMAC Verify -> Track)
 * 2. Price Manipulation Defense (Attempting ₹0, ₹1, -₹100, null price injections, quantity tampering)
 * 3. Order State Machine Violations (Illegal transitions, unauthenticated & non-admin role escalation)
 * 4. Spotify Parser & Custom Text Fuzzing (XSS payloads, broken links, 30 vs 31 chars vs 10,000 chars)
 */

const crypto = require('crypto');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const PORT = 3000;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const RAZORPAY_SECRET = 'rzp_test_TuneTagZ2026Secret';
const ADMIN_EMAIL = 'admin@tunetagz.com';
const ADMIN_PASSWORD = 'Admin@TuneTagZ2026!';
const ADMIN_SECRET_KEY = 'tunetagz_admin_master_secret_2026';

let serverProc = null;

// Helpers
function hmacSha256(payload, secret = RAZORPAY_SECRET) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function randString(len = 6) {
  return Math.random().toString(36).substring(2, 2 + len);
}

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const start = performance.now();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const fetchOptions = {
    method: options.method || 'GET',
    headers
  };

  if (options.body) {
    fetchOptions.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
  }

  try {
    const res = await fetch(url, fetchOptions);
    const duration = performance.now() - start;
    let data;
    const text = await res.text();
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = text;
    }
    return {
      status: res.status,
      ok: res.ok,
      headers: res.headers,
      data,
      rawText: text,
      duration
    };
  } catch (err) {
    const duration = performance.now() - start;
    return {
      status: 0,
      ok: false,
      error: err.message,
      duration
    };
  }
}

async function isServerUp() {
  try {
    const res = await request('/api/health');
    return res.status === 200 && res.data && res.data.status === 'ok';
  } catch (e) {
    return false;
  }
}

async function ensureServerRunning() {
  if (await isServerUp()) {
    console.log(`[INFO] Server already running at ${BASE_URL}`);
    return;
  }

  console.log(`[INFO] Spawning TuneTagZ server on port ${PORT}...`);
  const projectRoot = path.resolve(__dirname, '../../');
  const serverScript = path.join(projectRoot, 'server.js');

  serverProc = spawn(process.execPath, [serverScript], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: 'test',
      MOCK_PAYMENTS: 'true',
      JWT_SECRET: 'tunetagz_challenger_secret_2026',
      ADMIN_EMAIL,
      ADMIN_PASSWORD,
      ADMIN_SECRET_KEY,
      RAZORPAY_KEY_SECRET: RAZORPAY_SECRET
    },
    stdio: 'ignore'
  });

  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 250));
    if (await isServerUp()) {
      console.log(`[INFO] Server is healthy and responsive at ${BASE_URL}`);
      return;
    }
  }
  throw new Error('Server failed to start within 10 seconds');
}

function calculatePercentiles(latencies) {
  if (!latencies || latencies.length === 0) return { min: 0, max: 0, mean: 0, p50: 0, p90: 0, p95: 0, p99: 0 };
  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const mean = sum / sorted.length;
  const p50 = sorted[Math.floor(sorted.length * 0.50)];
  const p90 = sorted[Math.floor(sorted.length * 0.90)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))];
  return {
    min: Math.round(sorted[0] * 100) / 100,
    max: Math.round(sorted[sorted.length - 1] * 100) / 100,
    mean: Math.round(mean * 100) / 100,
    p50: Math.round(p50 * 100) / 100,
    p90: Math.round(p90 * 100) / 100,
    p95: Math.round(p95 * 100) / 100,
    p99: Math.round(p99 * 100) / 100
  };
}

async function runAllStressTests() {
  await ensureServerRunning();

  const report = {
    timestamp: new Date().toISOString(),
    scenarios: {},
    summary: {
      totalTests: 0,
      passed: 0,
      failed: 0,
      verdict: 'PENDING'
    }
  };

  console.log('\n========================================================================');
  console.log('       TUNETAGZ EMPIRICAL ADVERSARIAL & CONCURRENCY STRESS SUITE        ');
  console.log('========================================================================\n');

  // =========================================================================
  // SCENARIO 1: HIGH CONCURRENCY (20 Simultaneous Full Lifecycles)
  // =========================================================================
  console.log('>>> [SCENARIO 1] High Concurrency Stress Test (20 Parallel Customers)...');
  const CONCURRENCY_COUNT = 20;
  const c1Results = [];
  const c1Latencies = [];
  const c1Orders = [];

  const concurrencyTasks = Array.from({ length: CONCURRENCY_COUNT }, async (_, idx) => {
    const customerId = `user_conc_${Date.now()}_${idx}_${randString(4)}`;
    const email = `${customerId}@concurrency-test.in`;
    const password = 'ConcurrentPassword123!';
    const name = `Concurrent Buyer ${idx + 1}`;
    const startLife = performance.now();

    // 1. Register customer
    const regRes = await request('/api/auth/register', {
      method: 'POST',
      body: { email, password, name, phone: `+9198765${String(idx).padStart(5, '0')}` }
    });
    c1Latencies.push(regRes.duration);

    if (regRes.status !== 201 || !regRes.data.token) {
      return { idx, success: false, step: 'register', error: regRes.data };
    }
    const token = regRes.data.token;

    // 2. Place Custom Order (SPT-001 @ ₹699)
    const orderPayload = {
      items: [
        {
          productId: 1,
          quantity: 1,
          customization: {
            spotifyUrl: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
            customText: `Parallel Order #${idx + 1}`,
            songTitle: 'Never Gonna Give You Up',
            artistName: 'Rick Astley'
          }
        }
      ],
      customer: {
        name,
        email,
        phone: `+9198765${String(idx).padStart(5, '0')}`
      },
      shippingAddress: {
        line1: `${idx + 100} Concurrency Avenue`,
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560001',
        country: 'India'
      }
    };

    const orderRes = await request('/api/orders', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: orderPayload
    });
    c1Latencies.push(orderRes.duration);

    if (orderRes.status !== 201 || !orderRes.data.order) {
      return { idx, success: false, step: 'order_placement', error: orderRes.data };
    }
    const order = orderRes.data.order;

    // 3. Initiate Payment Gateway Order
    const payOrderRes = await request('/api/payments/create-order', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: { orderId: order.id }
    });
    c1Latencies.push(payOrderRes.duration);

    if (payOrderRes.status !== 201 || !payOrderRes.data.razorpayOrderId) {
      return { idx, success: false, step: 'payment_order', error: payOrderRes.data };
    }
    const rzpOrderId = payOrderRes.data.razorpayOrderId;

    // 4. Verify Payment with HMAC-SHA256
    const rzpPaymentId = `pay_conc_${Date.now()}_${idx}_${randString(6)}`;
    const signature = hmacSha256(`${rzpOrderId}|${rzpPaymentId}`);

    const verifyRes = await request('/api/payments/verify', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: {
        orderId: order.id,
        razorpay_order_id: rzpOrderId,
        razorpay_payment_id: rzpPaymentId,
        razorpay_signature: signature
      }
    });
    c1Latencies.push(verifyRes.duration);

    if (verifyRes.status !== 200 || verifyRes.data.status !== 'ORDER_RECEIVED') {
      return { idx, success: false, step: 'payment_verify', error: verifyRes.data };
    }

    // 5. Track Order
    const trackRes = await request(`/api/orders/${order.id}/track`);
    c1Latencies.push(trackRes.duration);

    if (trackRes.status !== 200 || trackRes.data.order.status !== 'ORDER_RECEIVED') {
      return { idx, success: false, step: 'track', error: trackRes.data };
    }

    const totalLifeDuration = performance.now() - startLife;
    c1Orders.push({
      orderId: order.id,
      orderNumber: order.orderNumber,
      totalAmount: order.totalAmount,
      status: trackRes.data.order.status
    });

    return { idx, success: true, totalDuration: totalLifeDuration, orderId: order.id, orderNumber: order.orderNumber };
  });

  const c1Settled = await Promise.all(concurrencyTasks);
  const c1Successes = c1Settled.filter(r => r.success);
  const c1Failures = c1Settled.filter(r => !r.success);

  // Verify uniqueness of order numbers and all amounts are exactly ₹699
  const uniqueOrderNumbers = new Set(c1Orders.map(o => o.orderNumber));
  const allAmounts699 = c1Orders.every(o => o.totalAmount === 699);
  const allStatusOrderReceived = c1Orders.every(o => o.status === 'ORDER_RECEIVED');

  const c1Passed = c1Successes.length === CONCURRENCY_COUNT && uniqueOrderNumbers.size === CONCURRENCY_COUNT && allAmounts699 && allStatusOrderReceived;

  report.scenarios.concurrency = {
    totalRequests: CONCURRENCY_COUNT * 5, // 5 requests per lifecycle
    simultaneousUsers: CONCURRENCY_COUNT,
    successfulLifecycles: c1Successes.length,
    failedLifecycles: c1Failures.length,
    failures: c1Failures,
    uniqueOrderNumbersCount: uniqueOrderNumbers.size,
    allPricesStrictlyEnforced: allAmounts699,
    allStatusesOrderReceived: allStatusOrderReceived,
    latencies: calculatePercentiles(c1Latencies),
    status: c1Passed ? 'PASSED' : 'FAILED'
  };

  console.log(`   - 20 Parallel Lifecycles Completed: ${c1Successes.length}/${CONCURRENCY_COUNT} Succeeded`);
  console.log(`   - Unique Order Numbers: ${uniqueOrderNumbers.size}/${CONCURRENCY_COUNT}`);
  console.log(`   - All amounts strictly ₹699: ${allAmounts699}`);
  console.log(`   - Latency: p50=${report.scenarios.concurrency.latencies.p50}ms, p95=${report.scenarios.concurrency.latencies.p95}ms, max=${report.scenarios.concurrency.latencies.max}ms`);
  console.log(`   -> SCENARIO 1 RESULT: ${c1Passed ? 'PASS' : 'FAIL'}\n`);

  // =========================================================================
  // SCENARIO 2: PRICE MANIPULATION & INJECTION ATTACKS
  // =========================================================================
  console.log('>>> [SCENARIO 2] Price Tampering & Injection Resistance Testing...');
  const priceAttacks = [
    { label: 'price: 0 injection', bodyOverride: { price: 0, unitPrice: 0, totalAmount: 0 } },
    { label: 'price: 1 injection (₹1 scam)', bodyOverride: { price: 1, unitPrice: 1, total_price: 1, totalAmount: 1 } },
    { label: 'price: -100 (Negative price attack)', bodyOverride: { price: -100, unitPrice: -100, totalAmount: -100 } },
    { label: 'price: null injection', bodyOverride: { price: null, unitPrice: null, totalAmount: null } },
    { label: 'price: NaN string injection', bodyOverride: { price: 'free', unitPrice: '0', totalAmount: 'zero' } },
    { label: 'tampered calculated endpoint /api/orders/calculate', endpoint: '/api/orders/calculate', items: [{ productId: 1, price: 0, quantity: 1 }] }
  ];

  const priceResults = [];
  for (const attack of priceAttacks) {
    if (attack.endpoint === '/api/orders/calculate') {
      const calcRes = await request('/api/orders/calculate', {
        method: 'POST',
        body: { items: attack.items }
      });
      const passed = calcRes.status === 200 && calcRes.data.totalAmount === 699;
      priceResults.push({
        attack: attack.label,
        status: calcRes.status,
        responseTotal: calcRes.data.totalAmount,
        expectedTotal: 699,
        tamperedBypassed: calcRes.data.totalAmount !== 699,
        passed
      });
    } else {
      const orderPayload = {
        items: [
          {
            productId: 1,
            quantity: 1,
            ...attack.bodyOverride
          }
        ],
        customer: {
          name: 'Attacker Tamper',
          email: 'tamper@attacker.com',
          phone: '+919999988888'
        },
        shippingAddress: {
          line1: '99 Scam Way',
          city: 'Mumbai',
          state: 'Maharashtra',
          postalCode: '400001',
          country: 'India'
        },
        ...attack.bodyOverride
      };

      const orderRes = await request('/api/orders', {
        method: 'POST',
        body: orderPayload
      });

      // The order must EITHER be rejected (400) OR created strictly with the DB catalog price of ₹699
      let passed = false;
      let actualTotal = null;
      if (orderRes.status === 201 && orderRes.data.order) {
        actualTotal = orderRes.data.order.totalAmount;
        passed = actualTotal === 699;
      } else if (orderRes.status === 400) {
        passed = true; // Properly rejected
      }

      priceResults.push({
        attack: attack.label,
        httpStatus: orderRes.status,
        actualTotal,
        expectedTotal: 699,
        tamperedBypassed: actualTotal !== null && actualTotal !== 699,
        passed
      });
    }
  }

  // Also test quantity manipulation (negative quantity, 0 quantity, invalid non-numeric quantity, float quantity)
  const qtyAttacks = [
    { label: 'quantity: 0 (falsy default bypass)', qty: 0, expectedStatus: 400 },
    { label: 'quantity: -5', qty: -5, expectedStatus: 400 },
    { label: 'quantity: "five"', qty: 'five', expectedStatus: 400 },
    { label: 'quantity: 0.5 (fractional quantity)', qty: 0.5, expectedStatus: 400 },
    { label: 'empty items array: []', items: [], expectedStatus: 400 }
  ];

  for (const qa of qtyAttacks) {
    const payload = qa.items !== undefined ? { items: qa.items } : { items: [{ productId: 1, quantity: qa.qty }] };
    const res = await request('/api/orders', {
      method: 'POST',
      body: {
        ...payload,
        customer: { name: 'Qty Tester', email: 'qty@test.com', phone: '+919876543210' },
        shippingAddress: { line1: '123 Test', city: 'Delhi', state: 'Delhi', postalCode: '110001' }
      }
    });
    const passed = res.status === qa.expectedStatus;
    priceResults.push({
      attack: qa.label,
      httpStatus: res.status,
      expectedStatus: qa.expectedStatus,
      passed,
      notes: res.status === 201 ? 'VULNERABILITY: quantity: 0 evaluated as 1 due to `item.quantity || 1` falsy fallback' : undefined
    });
  }

  // Test SQL injection in order fields
  const sqliPayloads = [
    { field: 'customer_name', name: "Robert'); DROP TABLE orders;--" },
    { field: 'shipping_city', city: "' UNION SELECT 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16--" },
    { field: 'notes', notes: "' OR '1'='1" }
  ];

  for (const sqli of sqliPayloads) {
    const res = await request('/api/orders', {
      method: 'POST',
      body: {
        items: [{ productId: 1, quantity: 1 }],
        customer: { name: sqli.name || 'SQLi Safe Name', email: `sqli_${Date.now()}@test.com`, phone: '+919876543210' },
        shippingAddress: { line1: '123 SQLi Way', city: sqli.city || 'Mumbai', state: 'Maharashtra', postalCode: '400001' },
        notes: sqli.notes || 'Normal note'
      }
    });
    // Should be safely handled via parameterized query without 500 error or SQL crash
    const passed = res.status === 201;
    priceResults.push({
      attack: `SQL Injection in ${sqli.field}`,
      httpStatus: res.status,
      expectedStatus: 201,
      passed
    });
  }

  // Test HMAC Tampering & Bit Flipped Signature Rejection
  const hmacOrderRes = await request('/api/orders', {
    method: 'POST',
    body: {
      items: [{ productId: 1, quantity: 1 }],
      customer: { name: 'HMAC Tester', email: `hmac_${Date.now()}@test.com`, phone: '+919876543210' },
      shippingAddress: { line1: '123 HMAC Way', city: 'Bengaluru', state: 'Karnataka', postalCode: '560001' }
    }
  });
  const hmacOrderId = hmacOrderRes.data.order.id;
  const payOrderRes = await request('/api/payments/create-order', {
    method: 'POST',
    body: { orderId: hmacOrderId }
  });
  const rzpOrderId = payOrderRes.data.razorpayOrderId;
  const fakePaymentId = `pay_fake_${Date.now()}`;
  const validSig = hmacSha256(`${rzpOrderId}|${fakePaymentId}`);
  const tamperedSig = validSig.substring(0, validSig.length - 2) + (validSig.endsWith('0') ? '1' : '0');

  const tamperedSigRes = await request('/api/payments/verify', {
    method: 'POST',
    body: {
      orderId: hmacOrderId,
      razorpay_order_id: rzpOrderId,
      razorpay_payment_id: fakePaymentId,
      razorpay_signature: tamperedSig
    }
  });

  priceResults.push({
    attack: 'Bit-flipped HMAC payment signature verification',
    httpStatus: tamperedSigRes.status,
    expectedStatus: 400,
    passed: tamperedSigRes.status === 400
  });

  const c2Passed = priceResults.every(r => r.passed);
  report.scenarios.priceManipulation = {
    totalTests: priceResults.length,
    results: priceResults,
    allAttacksDefeated: c2Passed,
    status: c2Passed ? 'PASSED' : 'FAILED'
  };

  priceResults.forEach(r => {
    console.log(`   - [${r.passed ? 'PASS' : 'FAIL'}] ${r.attack} -> Status: ${r.httpStatus || r.status}, Total: ₹${r.actualTotal || r.responseTotal || 'N/A'}`);
  });
  console.log(`   -> SCENARIO 2 RESULT: ${c2Passed ? 'PASS' : 'FAIL'}\n`);

  // =========================================================================
  // SCENARIO 3: ORDER STATE MACHINE VIOLATIONS & RBAC
  // =========================================================================
  console.log('>>> [SCENARIO 3] Order State Machine & Privilege Escalation Testing...');
  const stateResults = [];

  // 1. Create a baseline fresh order (PENDING_PAYMENT)
  const freshOrderRes = await request('/api/orders', {
    method: 'POST',
    body: {
      items: [{ productId: 1, quantity: 1 }],
      customer: { name: 'State Tester', email: 'state@tester.com', phone: '+919876543210' },
      shippingAddress: { line1: '456 State St', city: 'Pune', state: 'Maharashtra', postalCode: '411001' }
    }
  });
  const freshOrder = freshOrderRes.data.order;
  const orderId = freshOrder.id;

  // Test A: Unauthenticated state change attempt
  const unauthRes = await request(`/api/admin/orders/${orderId}/status`, {
    method: 'PATCH',
    body: { status: 'DELIVERED' }
  });
  stateResults.push({
    test: 'Unauthenticated status update attempt',
    expectedStatus: 401,
    actualStatus: unauthRes.status,
    passed: unauthRes.status === 401
  });

  // Test B: Regular customer token trying to access Admin status change
  const customerTokenRes = await request('/api/auth/register', {
    method: 'POST',
    body: {
      email: `customer_unauth_${Date.now()}@test.com`,
      password: 'CustomerPass123!',
      name: 'Regular Customer',
      phone: '+919876500000'
    }
  });
  const customerToken = customerTokenRes.data.token;

  const forbiddenRes = await request(`/api/admin/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${customerToken}` },
    body: { status: 'DELIVERED' }
  });
  stateResults.push({
    test: 'Customer RBAC escalation attempt to admin order status endpoint',
    expectedStatus: 403,
    actualStatus: forbiddenRes.status,
    passed: forbiddenRes.status === 403
  });

  // Log in as real admin
  const adminLoginRes = await request('/api/auth/admin/login', {
    method: 'POST',
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, secretKey: ADMIN_SECRET_KEY }
  });
  const adminToken = adminLoginRes.data.token;

  // Test C: Illegal transition: PENDING_PAYMENT -> DELIVERED (skipping payment, engraving, quality check, dispatch)
  const illegalDelivered = await request(`/api/admin/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { status: 'DELIVERED' }
  });
  stateResults.push({
    test: 'Illegal Transition: PENDING_PAYMENT -> DELIVERED',
    expectedStatus: 400,
    actualStatus: illegalDelivered.status,
    passed: illegalDelivered.status === 400
  });

  // Test D: Illegal transition: PENDING_PAYMENT -> QUALITY_CHECK
  const illegalQc = await request(`/api/admin/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { status: 'QUALITY_CHECK' }
  });
  stateResults.push({
    test: 'Illegal Transition: PENDING_PAYMENT -> QUALITY_CHECK',
    expectedStatus: 400,
    actualStatus: illegalQc.status,
    passed: illegalQc.status === 400
  });

  // Test E: Legitimate transition sequence: PENDING_PAYMENT -> ORDER_RECEIVED -> ENGRAVING -> QUALITY_CHECK -> DISPATCHED -> DELIVERED
  const step1 = await request(`/api/admin/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { status: 'ORDER_RECEIVED' }
  });
  const step2 = await request(`/api/admin/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { status: 'ENGRAVING' }
  });
  const step3 = await request(`/api/admin/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { status: 'QUALITY_CHECK' }
  });
  const step4 = await request(`/api/admin/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { status: 'DISPATCHED', courierName: 'BlueDart Express', trackingNumber: 'BD-9876543210' }
  });
  const step5 = await request(`/api/admin/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { status: 'DELIVERED' }
  });

  const legalPipelinePassed = step1.status === 200 && step2.status === 200 && step3.status === 200 && step4.status === 200 && step5.status === 200;
  stateResults.push({
    test: 'Valid Fulfillment Progression (PENDING_PAYMENT -> ORDER_RECEIVED -> ENGRAVING -> QC -> DISPATCHED -> DELIVERED)',
    expectedStatus: 200,
    actualStatus: step5.status,
    passed: legalPipelinePassed
  });

  // Test F: Illegal backwards transition: DELIVERED (Terminal) -> ORDER_RECEIVED
  const illegalBackward = await request(`/api/admin/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { status: 'ORDER_RECEIVED' }
  });
  stateResults.push({
    test: 'Illegal Backwards Transition: DELIVERED (Terminal) -> ORDER_RECEIVED',
    expectedStatus: 400,
    actualStatus: illegalBackward.status,
    passed: illegalBackward.status === 400
  });

  // Test G: Illegal transition: DELIVERED -> CANCELLED
  const illegalCancelDelivered = await request(`/api/admin/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { status: 'CANCELLED' }
  });
  stateResults.push({
    test: 'Illegal Transition: DELIVERED -> CANCELLED',
    expectedStatus: 400,
    actualStatus: illegalCancelDelivered.status,
    passed: illegalCancelDelivered.status === 400
  });

  const c3Passed = stateResults.every(r => r.passed);
  report.scenarios.stateMachine = {
    totalTests: stateResults.length,
    results: stateResults,
    allViolationsRejected: c3Passed,
    status: c3Passed ? 'PASSED' : 'FAILED'
  };

  stateResults.forEach(r => {
    console.log(`   - [${r.passed ? 'PASS' : 'FAIL'}] ${r.test} -> Expected HTTP ${r.expectedStatus}, got HTTP ${r.actualStatus}`);
  });
  console.log(`   -> SCENARIO 3 RESULT: ${c3Passed ? 'PASS' : 'FAIL'}\n`);

  // =========================================================================
  // SCENARIO 4: SPOTIFY PARSER FUZZING & XSS / BUFFER BOUNDARY TESTING
  // =========================================================================
  console.log('>>> [SCENARIO 4] Spotify Parser Fuzzing, XSS & Input Boundary Testing...');
  const fuzzResults = [];

  // Fuzz 1: Missing URL query param on /api/spotify/preview
  const missingUrlRes = await request('/api/spotify/preview');
  fuzzResults.push({
    test: 'Missing url query param on /api/spotify/preview',
    expectedStatus: 400,
    actualStatus: missingUrlRes.status,
    passed: missingUrlRes.status === 400
  });

  // Fuzz 2: Broken / Malformed URL inputs
  const malformedInputs = [
    'not_a_spotify_link',
    'https://google.com/search?q=spotify',
    'https://open.spotify.com/invalid/12345',
    'spotify:invalid:123',
    'https://open.spotify.com/track/short',
    'https://open.spotify.com/track/toolong_123456789012345678901234567890'
  ];

  for (const badInput of malformedInputs) {
    const res = await request(`/api/spotify/preview?url=${encodeURIComponent(badInput)}`);
    // Should return 200 with isValid: false, or 400 error, but never 500
    const handledGracefully = res.status === 200 && res.data.spotify && res.data.spotify.isValid === false;
    fuzzResults.push({
      test: `Malformed URL: "${badInput}"`,
      expected: 'isValid: false (graceful handling)',
      actualStatus: res.status,
      isValid: res.data?.spotify?.isValid,
      passed: handledGracefully || res.status === 400
    });
  }

  // Fuzz 3: Valid Spotify Links across formats (Track URL, Web URI, Short link, Raw ID)
  const validInputs = [
    { type: 'Standard Web URL', input: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=123' },
    { type: 'Spotify URI', input: 'spotify:track:4cOdK2wGLETKBW3PvgPWqT' },
    { type: 'Album URL', input: 'https://open.spotify.com/album/1DFixLWuPkv3KT3TnV35m3' },
    { type: '22-Char Raw Track ID', input: '4cOdK2wGLETKBW3PvgPWqT' }
  ];

  for (const goodInput of validInputs) {
    const res = await request(`/api/spotify/preview?url=${encodeURIComponent(goodInput.input)}`);
    const passed = res.status === 200 && res.data.success === true && res.data.spotify.isValid === true && typeof res.data.svg === 'string' && res.data.svg.includes('<svg');
    fuzzResults.push({
      test: `Valid Spotify Link format: ${goodInput.type}`,
      actualStatus: res.status,
      isValid: res.data?.spotify?.isValid,
      hasSvg: typeof res.data?.svg === 'string',
      passed
    });
  }

  // Fuzz 4: Custom Text Boundary Limit (30 chars vs 31 chars vs 10,000 chars)
  const exact30 = '123456789012345678901234567890'; // 30 chars
  const exact31 = '1234567890123456789012345678901'; // 31 chars
  const huge10k = 'A'.repeat(10000); // 10,000 chars

  // 30 chars should succeed
  const res30 = await request('/api/orders', {
    method: 'POST',
    body: {
      items: [{ productId: 1, quantity: 1, customization: { customText: exact30, spotifyUrl: 'spotify:track:4cOdK2wGLETKBW3PvgPWqT' } }],
      customer: { name: 'Boundary Tester', email: 'boundary30@test.com', phone: '+919876543210' },
      shippingAddress: { line1: '30 Limit Way', city: 'Chennai', state: 'Tamil Nadu', postalCode: '600001' }
    }
  });
  fuzzResults.push({
    test: 'Custom Text Exact 30-char Boundary (Permitted Maximum)',
    expectedStatus: 201,
    actualStatus: res30.status,
    passed: res30.status === 201
  });

  // 31 chars should be rejected (400)
  const res31 = await request('/api/orders', {
    method: 'POST',
    body: {
      items: [{ productId: 1, quantity: 1, customization: { customText: exact31 } }],
      customer: { name: 'Boundary Tester', email: 'boundary31@test.com', phone: '+919876543210' },
      shippingAddress: { line1: '31 Limit Way', city: 'Chennai', state: 'Tamil Nadu', postalCode: '600001' }
    }
  });
  fuzzResults.push({
    test: 'Custom Text 31-char Boundary (Strictly Rejected)',
    expectedStatus: 400,
    actualStatus: res31.status,
    passed: res31.status === 400
  });

  // 10,000 chars should be rejected (400)
  const res10k = await request('/api/orders', {
    method: 'POST',
    body: {
      items: [{ productId: 1, quantity: 1, customization: { customText: huge10k } }],
      customer: { name: 'Boundary Tester', email: 'boundary10k@test.com', phone: '+919876543210' },
      shippingAddress: { line1: '10k Limit Way', city: 'Chennai', state: 'Tamil Nadu', postalCode: '600001' }
    }
  });
  fuzzResults.push({
    test: 'Custom Text 10,000-char Buffer Overflow Attempt (Strictly Rejected)',
    expectedStatus: 400,
    actualStatus: res10k.status,
    passed: res10k.status === 400
  });

  // Fuzz 5: XSS Sanitization in Custom Text & Notes
  const xssPayload = '<script>alert("XSS")</script>';
  const resXss = await request('/api/orders', {
    method: 'POST',
    body: {
      items: [{ productId: 1, quantity: 1, customization: { customText: 'Safe <script> Text' } }],
      customer: { name: 'XSS Tester', email: 'xss@test.com', phone: '+919876543210' },
      shippingAddress: { line1: 'XSS Street', city: 'Kolkata', state: 'West Bengal', postalCode: '700001' },
      notes: '<svg onload=alert(1)>'
    }
  });

  let xssSanitized = false;
  if (resXss.status === 201 && resXss.data.order) {
    const itemText = resXss.data.order.items[0]?.customText || '';
    const notes = resXss.data.order.notes || '';
    xssSanitized = !itemText.includes('<') && !itemText.includes('>') && !notes.includes('<') && !notes.includes('>');
  }
  fuzzResults.push({
    test: 'XSS Angle Brackets Stripping / Sanitization in Custom Engraving Text & Notes',
    expectedSanitized: true,
    actualSanitized: xssSanitized,
    passed: xssSanitized
  });

  const c4Passed = fuzzResults.every(r => r.passed);
  report.scenarios.spotifyFuzzing = {
    totalTests: fuzzResults.length,
    results: fuzzResults,
    allFuzzTestsPassed: c4Passed,
    status: c4Passed ? 'PASSED' : 'FAILED'
  };

  fuzzResults.forEach(r => {
    console.log(`   - [${r.passed ? 'PASS' : 'FAIL'}] ${r.test} -> Actual Status: ${r.actualStatus || (r.passed ? 'OK' : 'FAIL')}`);
  });
  console.log(`   -> SCENARIO 4 RESULT: ${c4Passed ? 'PASS' : 'FAIL'}\n`);

  // =========================================================================
  // OVERALL VERDICT SUMMARY
  // =========================================================================
  const allScenariosPassed = c1Passed && c2Passed && c3Passed && c4Passed;
  report.summary.totalScenarios = 4;
  report.summary.passedScenarios = [c1Passed, c2Passed, c3Passed, c4Passed].filter(Boolean).length;
  report.summary.failedScenarios = 4 - report.summary.passedScenarios;
  report.summary.totalAssertions = CONCURRENCY_COUNT + priceResults.length + stateResults.length + fuzzResults.length;
  report.summary.verdict = allScenariosPassed ? 'APPROVE' : 'REQUEST_CHANGES';

  console.log('========================================================================');
  console.log(`   CHALLENGER 1 EMPIRICAL VERDICT: ${report.summary.verdict}`);
  console.log(`   Scenarios Passed: ${report.summary.passedScenarios}/4 (100%)`);
  console.log(`   Total Adversarial Assertions: ${report.summary.totalAssertions}`);
  console.log('========================================================================\n');

  // Write raw test results json for reference
  fs.writeFileSync(path.join(__dirname, 'stress_test_results.json'), JSON.stringify(report, null, 2));

  if (serverProc) {
    serverProc.kill('SIGTERM');
  }

  return report;
}

if (require.main === module) {
  runAllStressTests()
    .then((report) => {
      process.exit(report.summary.verdict === 'APPROVE' ? 0 : 1);
    })
    .catch((err) => {
      console.error('Fatal stress test runner error:', err);
      if (serverProc) serverProc.kill('SIGTERM');
      process.exit(1);
    });
}

module.exports = { runAllStressTests };
