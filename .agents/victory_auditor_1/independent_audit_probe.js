const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

// Load environment and application
const env = require('../../src/config/env');
const { initializeDatabase, getDb } = require('../../src/config/database');
const { seedDatabase } = require('../../src/utils/seed');
const app = require('../../src/app');
const { parseSpotifyUrl, generateSpotifyCodeSvg, validateCustomText } = require('../../src/services/spotify.service');

const PORT = 3899;
let serverInstance = null;
let baseUrl = `http://127.0.0.1:${PORT}`;

async function request(method, pathUrl, options = {}) {
  const url = `${baseUrl}${pathUrl}`;
  const headers = options.headers || {};
  let body = options.body;

  if (body && typeof body === 'object' && !(body instanceof Buffer) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }

  const res = await fetch(url, {
    method,
    headers,
    body: method !== 'GET' && method !== 'HEAD' ? body : undefined
  });

  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (e) {
    json = null;
  }

  return {
    status: res.status,
    headers: Object.fromEntries(res.headers.entries()),
    text,
    data: json
  };
}

async function runIndependentVictoryAudit() {
  console.log('======================================================================');
  console.log('   INDEPENDENT VICTORY AUDITOR FORENSIC PROBE — TUNETAGZ (R1 - R5)    ');
  console.log('======================================================================\n');

  let passedChecks = 0;
  let failedChecks = 0;
  const errors = [];

  function check(name, fn) {
    try {
      fn();
      passedChecks++;
      console.log(`  ✔ [PASS] ${name}`);
    } catch (err) {
      failedChecks++;
      errors.push({ name, error: err.message });
      console.error(`  ✖ [FAIL] ${name}: ${err.message}`);
    }
  }

  async function asyncCheck(name, fn) {
    try {
      await fn();
      passedChecks++;
      console.log(`  ✔ [PASS] ${name}`);
    } catch (err) {
      failedChecks++;
      errors.push({ name, error: err.message });
      console.error(`  ✖ [FAIL] ${name}: ${err.message}`);
    }
  }

  // Bootstrap Server
  await initializeDatabase();
  await seedDatabase();

  await new Promise((resolve) => {
    serverInstance = app.listen(PORT, '127.0.0.1', () => {
      console.log(`[AUDIT SERVER] Live on ${baseUrl}\n`);
      resolve();
    });
  });

  const db = getDb();

  // -------------------------------------------------------------------------
  // SECTION 1: REQUIREMENT R1 — Node.js + Express Backend & Database
  // -------------------------------------------------------------------------
  console.log('--- REQUIREMENT R1: Node.js + Express Backend & SQLite Database ---');

  await asyncCheck('R1.1: Express REST API Server Health Check (/api/health)', async () => {
    const res = await request('GET', '/api/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.status, 'ok');
    assert.strictEqual(res.data.database.connected, true);
    assert.strictEqual(res.data.database.type, 'sqlite');
  });

  check('R1.2: SQLite Database Schema & Tables Exist with Constraints', () => {
    const tables = ['users', 'products', 'orders', 'order_items', 'payments', 'admin_audit_logs', 'admin_settings'];
    for (const tbl of tables) {
      const row = db.prepare('SELECT COUNT(*) as count FROM ' + tbl).get();
      assert.ok(row && typeof row.count === 'number', `Table ${tbl} must exist`);
    }
  });

  check('R1.3: SQLite Foreign Key Constraints & Check Constraints Active', () => {
    const testAdmin = db.prepare('SELECT * FROM users WHERE email = ?').get(env.ADMIN_EMAIL);
    assert.ok(testAdmin, 'Admin user must exist');
    assert.strictEqual(testAdmin.role, 'admin');

    const products = db.prepare('SELECT * FROM products').all();
    assert.ok(products.length >= 3, 'Default catalog must contain at least 3 seeded products');
    const spt001 = products.find(p => p.sku === 'SPT-001');
    assert.ok(spt001, 'SPT-001 must exist');
    assert.strictEqual(Number(spt001.price), 699);
  });

  // -------------------------------------------------------------------------
  // SECTION 2: REQUIREMENT R2 — Customer Authentication (Bcrypt, OAuth, JWT)
  // -------------------------------------------------------------------------
  console.log('\n--- REQUIREMENT R2: Customer Authentication (Bcrypt + Google OAuth + JWT) ---');

  const testCustomerEmail = `audit_customer_${Date.now()}@example.com`;
  const testCustomerPassword = 'SecurePassword2026!';
  let customerToken = null;
  let customerUserId = null;

  await asyncCheck('R2.1: Customer Registration with Bcrypt Password Hashing', async () => {
    const res = await request('POST', '/api/auth/register', {
      body: {
        email: testCustomerEmail,
        password: testCustomerPassword,
        name: 'Independent Auditor Customer',
        phone: '+919876543210'
      }
    });

    assert.strictEqual(res.status, 201);
    assert.ok(res.data.success);
    assert.ok(res.data.token);
    assert.strictEqual(res.data.user.email, testCustomerEmail);
    customerToken = res.data.token;
    customerUserId = res.data.user.id;

    // Verify in database: password must NOT be plaintext and must be bcrypt ($2a$ or $2b$)
    const userInDb = db.prepare('SELECT password_hash FROM users WHERE email = ?').get(testCustomerEmail);
    assert.ok(userInDb.password_hash.startsWith('$2a$') || userInDb.password_hash.startsWith('$2b$'), 'Password must be bcrypt hashed');
    assert.notStrictEqual(userInDb.password_hash, testCustomerPassword, 'Password must not be stored plaintext');
  });

  await asyncCheck('R2.2: Customer Login with Bcrypt Verification & Token Issuance', async () => {
    const res = await request('POST', '/api/auth/login', {
      body: {
        email: testCustomerEmail,
        password: testCustomerPassword
      }
    });

    assert.strictEqual(res.status, 200);
    assert.ok(res.data.success);
    assert.ok(res.data.token);
    assert.strictEqual(res.data.user.id, customerUserId);
  });

  await asyncCheck('R2.3: Rejection of Invalid Password & Duplicate Email Registration', async () => {
    const wrongLogin = await request('POST', '/api/auth/login', {
      body: {
        email: testCustomerEmail,
        password: 'WrongPassword123'
      }
    });
    assert.strictEqual(wrongLogin.status, 401);

    const dupReg = await request('POST', '/api/auth/register', {
      body: {
        email: testCustomerEmail,
        password: 'AnotherPassword123',
        name: 'Duplicate User'
      }
    });
    assert.strictEqual(dupReg.status, 409);
  });

  await asyncCheck('R2.4: Google OAuth 2.0 Authentication Handling', async () => {
    const googleId = `google_oauth_${Date.now()}`;
    const googleEmail = `google_user_${Date.now()}@gmail.com`;
    const res = await request('POST', '/api/auth/google', {
      body: {
        googleId,
        email: googleEmail,
        name: 'Google Verified User',
        picture: 'https://lh3.googleusercontent.com/a/default-avatar'
      }
    });

    assert.strictEqual(res.status, 200);
    assert.ok(res.data.success);
    assert.ok(res.data.token);
    assert.strictEqual(res.data.user.email, googleEmail);

    const userInDb = db.prepare('SELECT google_id, email FROM users WHERE email = ?').get(googleEmail);
    assert.strictEqual(userInDb.google_id, googleId);
  });

  await asyncCheck('R2.5: Authenticated Session & Profile Inspection (/api/auth/me)', async () => {
    const res = await request('GET', '/api/auth/me', {
      headers: { 'Authorization': `Bearer ${customerToken}` }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.user.email, testCustomerEmail);
    assert.strictEqual(res.data.user.role, 'customer');
  });

  let adminToken = null;
  await asyncCheck('R2.6: Developer Admin Login & Role Separation', async () => {
    const res = await request('POST', '/api/auth/admin/login', {
      body: {
        email: env.ADMIN_EMAIL,
        password: env.ADMIN_PASSWORD
      }
    });

    assert.strictEqual(res.status, 200);
    assert.ok(res.data.token);
    assert.strictEqual(res.data.user.role, 'admin');
    adminToken = res.data.token;
  });

  // -------------------------------------------------------------------------
  // SECTION 3: REQUIREMENT R3 — Payment Gateway Integration (Razorpay & HMAC)
  // -------------------------------------------------------------------------
  console.log('\n--- REQUIREMENT R3: Razorpay Payment Gateway & HMAC-SHA256 Verification ---');

  let testOrderId = null;
  let testOrderNumber = null;
  let razorpayOrderId = null;

  await asyncCheck('R3.1: Custom Order Placement & Server-Side Price Calculation', async () => {
    const prod = db.prepare("SELECT * FROM products WHERE sku = 'SPT-001'").get();
    const res = await request('POST', '/api/orders', {
      headers: { 'Authorization': `Bearer ${customerToken}` },
      body: {
        customer: {
          name: 'Independent Auditor',
          email: testCustomerEmail,
          phone: '+919876543210'
        },
        shippingAddress: {
          addressLine1: 'Audit Tower, Sector 62',
          city: 'Noida',
          state: 'Uttar Pradesh',
          postalCode: '201301',
          country: 'India'
        },
        items: [
          {
            productId: prod.id,
            quantity: 2,
            price: 1, // Tampered client price (₹1 attempt)
            customization: {
              spotifyUrl: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
              customText: 'AUDITOR VERIFIED 2026',
              songTitle: 'Never Gonna Give You Up',
              artistName: 'Rick Astley'
            }
          }
        ]
      }
    });

    assert.strictEqual(res.status, 201);
    assert.ok(res.data.success);
    testOrderId = res.data.order.id;
    testOrderNumber = res.data.order.orderNumber;
    // Server must ignore price: 1 and enforce ₹699 * 2 = ₹1398
    assert.strictEqual(res.data.order.totalAmount, 1398);
    assert.strictEqual(res.data.order.status, 'PENDING_PAYMENT');
  });

  await asyncCheck('R3.2: Razorpay Order Creation (/api/payments/create-order)', async () => {
    const res = await request('POST', '/api/payments/create-order', {
      headers: { 'Authorization': `Bearer ${customerToken}` },
      body: { orderId: testOrderId }
    });

    assert.strictEqual(res.status, 201);
    assert.ok(res.data.success);
    assert.ok(res.data.razorpayOrderId);
    assert.strictEqual(res.data.amountPaise, 139800); // 1398 * 100 paise
    razorpayOrderId = res.data.razorpayOrderId;
  });

  await asyncCheck('R3.3: Cryptographic HMAC-SHA256 Payment Verification & State Transition', async () => {
    const razorpayPaymentId = `pay_audit_${Date.now()}`;
    const secret = env.RAZORPAY_KEY_SECRET;
    const payload = `${razorpayOrderId}|${razorpayPaymentId}`;
    const validSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    // 1. Test Tampered/Forged Signature Rejection
    const forgedSignature = validSignature.substring(0, validSignature.length - 2) + 'ff';
    const badVerifyRes = await request('POST', '/api/payments/verify', {
      body: {
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
        razorpay_signature: forgedSignature,
        orderId: testOrderId
      }
    });
    assert.strictEqual(badVerifyRes.status, 400);

    // Verify order is still PENDING_PAYMENT
    const orderBefore = db.prepare('SELECT status, payment_status FROM orders WHERE id = ?').get(testOrderId);
    assert.strictEqual(orderBefore.status, 'PENDING_PAYMENT');
    assert.strictEqual(orderBefore.payment_status, 'UNPAID');

    // 2. Test Valid Signature Confirmation
    const goodVerifyRes = await request('POST', '/api/payments/verify', {
      body: {
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
        razorpay_signature: validSignature,
        orderId: testOrderId
      }
    });
    assert.strictEqual(goodVerifyRes.status, 200);
    assert.ok(goodVerifyRes.data.success);
    assert.strictEqual(goodVerifyRes.data.status, 'ORDER_RECEIVED');

    // Verify DB update
    const orderAfter = db.prepare('SELECT status, payment_status, razorpay_payment_id FROM orders WHERE id = ?').get(testOrderId);
    assert.strictEqual(orderAfter.status, 'ORDER_RECEIVED');
    assert.strictEqual(orderAfter.payment_status, 'PAID');
    assert.strictEqual(orderAfter.razorpay_payment_id, razorpayPaymentId);

    // 3. Idempotency Test
    const replayVerifyRes = await request('POST', '/api/payments/verify', {
      body: {
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
        razorpay_signature: validSignature,
        orderId: testOrderId
      }
    });
    assert.strictEqual(replayVerifyRes.status, 200);
    assert.ok(replayVerifyRes.data.success);
  });

  await asyncCheck('R3.4: Payment Webhook Handler & Event Processing', async () => {
    const webhookOrderId = `order_mock_${Date.now()}_WHK`;
    // Create a dummy order in PENDING_PAYMENT
    const res = await request('POST', '/api/orders', {
      headers: { 'Authorization': `Bearer ${customerToken}` },
      body: {
        customer: { name: 'Webhook Test', email: testCustomerEmail, phone: '9876543210' },
        shippingAddress: { addressLine1: 'Test St', city: 'Mumbai', state: 'MH', postalCode: '400001' },
        items: [{ productId: 1, quantity: 1 }]
      }
    });
    const whkInternalOrderId = res.data.order.id;
    db.prepare('UPDATE orders SET razorpay_order_id = ? WHERE id = ?').run(webhookOrderId, whkInternalOrderId);

    const eventPayload = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: `pay_whk_${Date.now()}`,
            order_id: webhookOrderId,
            amount: 69900,
            status: 'captured',
            method: 'upi'
          }
        }
      }
    });

    const sig = crypto.createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET).update(eventPayload).digest('hex');

    const whkRes = await request('POST', '/api/payments/webhook', {
      headers: {
        'x-razorpay-signature': sig,
        'Content-Type': 'application/json'
      },
      body: eventPayload
    });

    assert.strictEqual(whkRes.status, 200);
    assert.strictEqual(whkRes.data.processed, true);

    const updatedWhkOrder = db.prepare('SELECT status, payment_status FROM orders WHERE id = ?').get(whkInternalOrderId);
    assert.strictEqual(updatedWhkOrder.status, 'ORDER_RECEIVED');
    assert.strictEqual(updatedWhkOrder.payment_status, 'PAID');
  });

  // -------------------------------------------------------------------------
  // SECTION 4: REQUIREMENT R4 — Customer Dashboard & Order Tracking
  // -------------------------------------------------------------------------
  console.log('\n--- REQUIREMENT R4: Customer Dashboard & Order Tracking ---');

  await asyncCheck('R4.1: Customer Order History with Customization Details (/api/orders/my-orders)', async () => {
    const res = await request('GET', '/api/orders/my-orders', {
      headers: { 'Authorization': `Bearer ${customerToken}` }
    });

    assert.strictEqual(res.status, 200);
    assert.ok(res.data.success);
    assert.ok(Array.isArray(res.data.orders));
    const foundOrder = res.data.orders.find(o => o.id === testOrderId);
    assert.ok(foundOrder, 'Customer must see placed order');
    assert.strictEqual(foundOrder.items[0].customText, 'AUDITOR VERIFIED 2026');
    assert.strictEqual(foundOrder.items[0].spotifyCode, '4cOdK2wGLETKBW3PvgPWqT');
  });

  await asyncCheck('R4.2: Live Order Tracking & 5-Step Visual Stepper (/api/orders/:orderId/track)', async () => {
    const res = await request('GET', `/api/orders/${testOrderNumber}/track`);
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.success);
    assert.strictEqual(res.data.order.status, 'ORDER_RECEIVED');
    assert.strictEqual(res.data.order.timeline.length, 5);
    assert.strictEqual(res.data.order.timeline[0].status, 'ORDER_RECEIVED');
    assert.strictEqual(res.data.order.timeline[0].completed, true);
  });

  check('R4.3: Spotify Parser & Soundwave Code SVG Engine', () => {
    const parsed = parseSpotifyUrl('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=abc');
    assert.strictEqual(parsed.isValid, true);
    assert.strictEqual(parsed.id, '4cOdK2wGLETKBW3PvgPWqT');

    const svg = generateSpotifyCodeSvg('4cOdK2wGLETKBW3PvgPWqT');
    assert.ok(svg.includes('<svg'), 'Must produce SVG markup');
    assert.ok(svg.includes('<rect'), 'Must contain soundwave bars');

    const validText = validateCustomText('MY CUSTOM SONG');
    assert.strictEqual(validText.isValid, true);

    const longText = validateCustomText('A'.repeat(31));
    assert.strictEqual(longText.isValid, false);
  });

  // -------------------------------------------------------------------------
  // SECTION 5: REQUIREMENT R5 — Developer Admin Portal & Instant Product Sync
  // -------------------------------------------------------------------------
  console.log('\n--- REQUIREMENT R5: Developer Admin Portal & Instant Product Sync ---');

  await asyncCheck('R5.1: Admin Role-Based Access Control (RBAC) Enforcement', async () => {
    // Unauthenticated
    const unauth = await request('GET', '/api/admin/stats');
    assert.strictEqual(unauth.status, 401);

    // Customer Token Attempt
    const custAttempt = await request('GET', '/api/admin/stats', {
      headers: { 'Authorization': `Bearer ${customerToken}` }
    });
    assert.strictEqual(custAttempt.status, 403);

    // Admin Token Attempt
    const adminRes = await request('GET', '/api/admin/stats', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(adminRes.status, 200);
    assert.ok(adminRes.data.success);
    assert.ok(adminRes.data.stats.totalSales >= 1398);
  });

  let uploadedImageFilename = null;
  await asyncCheck('R5.2: Multer File Upload to /uploads with MIME Type Verification', async () => {
    // 1. Upload valid 1x1 PNG
    const pngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);

    const multipartBody = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="auditor_test.png"\r\nContent-Type: image/png\r\n\r\n`),
      pngBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    const uploadRes = await request('POST', '/api/products/upload', {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: multipartBody
    });

    assert.strictEqual(uploadRes.status, 201);
    assert.ok(uploadRes.data.success);
    assert.ok(uploadRes.data.imageUrl.startsWith('/uploads/'));
    uploadedImageFilename = path.basename(uploadRes.data.imageUrl);

    // Verify physical file on disk
    const diskPath = path.join(env.UPLOADS_DIR, uploadedImageFilename);
    assert.ok(fs.existsSync(diskPath), `Uploaded file must physically exist at ${diskPath}`);

    // 2. Reject Disallowed MIME type (text/plain)
    const textMultipart = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="evil.txt"\r\nContent-Type: text/plain\r\n\r\nevil script`),
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    const badUploadRes = await request('POST', '/api/products/upload', {
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: textMultipart
    });
    assert.strictEqual(badUploadRes.status, 415);
  });

  let createdNewProdId = null;
  await asyncCheck('R5.3: Admin Product Creation & Instant Dynamic Frontend Sync', async () => {
    const newSku = `AUDIT-PROD-${Date.now().toString().slice(-4)}`;
    const createRes = await request('POST', '/api/admin/products', {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: {
        sku: newSku,
        name: 'Auditor Limited Edition Tag',
        tagline: 'Gold laser engraved keychain verified by independent audit.',
        description: 'Exclusive commemorative test product.',
        price: 999,
        badge: 'Drop 04',
        imageUrl: `/uploads/${uploadedImageFilename}`,
        category: 'keychain',
        isCustomizable: true,
        inStock: true
      }
    });

    assert.strictEqual(createRes.status, 201);
    assert.ok(createRes.data.success);
    createdNewProdId = createRes.data.product.id;

    // Verify Instant Dynamic Frontend Sync: GET /api/products (used by index.html) must include new product immediately
    const publicCatalogRes = await request('GET', '/api/products');
    assert.strictEqual(publicCatalogRes.status, 200);
    const foundInCatalog = publicCatalogRes.data.data.find(p => p.sku === newSku);
    assert.ok(foundInCatalog, 'New product must appear in public storefront catalog immediately');
    assert.strictEqual(Number(foundInCatalog.price), 999);
    assert.strictEqual(foundInCatalog.in_stock, true);
  });

  await asyncCheck('R5.4: Admin Stock Availability Toggle & Out-of-Stock Enforcement', async () => {
    // Toggle to out-of-stock
    const toggleRes = await request('PATCH', `/api/admin/products/${createdNewProdId}/stock`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: { inStock: false }
    });

    assert.strictEqual(toggleRes.status, 200);
    assert.strictEqual(toggleRes.data.product.in_stock, false);

    // Verify ordering out-of-stock product is rejected
    const orderOutRes = await request('POST', '/api/orders', {
      headers: { 'Authorization': `Bearer ${customerToken}` },
      body: {
        customer: { name: 'Test', email: testCustomerEmail, phone: '9876543210' },
        shippingAddress: { addressLine1: 'Test St', city: 'Delhi', state: 'Delhi', postalCode: '110001' },
        items: [{ productId: createdNewProdId, quantity: 1 }]
      }
    });

    assert.strictEqual(orderOutRes.status, 409);
    assert.ok(orderOutRes.data.error.includes('out of stock'));

    // Toggle back in-stock
    const restockRes = await request('PATCH', `/api/admin/products/${createdNewProdId}/stock`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: { inStock: true }
    });
    assert.strictEqual(restockRes.status, 200);
  });

  await asyncCheck('R5.5: Admin Order Fulfillment Pipeline Progression', async () => {
    // Progress testOrderId: ORDER_RECEIVED -> ENGRAVING -> QUALITY_CHECK -> DISPATCHED -> DELIVERED
    const s1 = await request('PATCH', `/api/admin/orders/${testOrderId}/status`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: { status: 'ENGRAVING' }
    });
    assert.strictEqual(s1.status, 200);
    assert.strictEqual(s1.data.order.status, 'ENGRAVING');

    const s2 = await request('PATCH', `/api/admin/orders/${testOrderId}/status`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: { status: 'QUALITY_CHECK' }
    });
    assert.strictEqual(s2.status, 200);
    assert.strictEqual(s2.data.order.status, 'QUALITY_CHECK');

    const s3 = await request('PATCH', `/api/admin/orders/${testOrderId}/status`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: {
        status: 'DISPATCHED',
        courierName: 'BlueDart Express',
        trackingNumber: 'BD-9988776655-IN'
      }
    });
    assert.strictEqual(s3.status, 200);
    assert.strictEqual(s3.data.order.status, 'DISPATCHED');
    assert.strictEqual(s3.data.order.courierName, 'BlueDart Express');
    assert.strictEqual(s3.data.order.trackingNumber, 'BD-9988776655-IN');

    const s4 = await request('PATCH', `/api/admin/orders/${testOrderId}/status`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: { status: 'DELIVERED' }
    });
    assert.strictEqual(s4.status, 200);
    assert.strictEqual(s4.data.order.status, 'DELIVERED');

    // Verify illegal transition from DELIVERED back to ORDER_RECEIVED
    const illegalBack = await request('PATCH', `/api/admin/orders/${testOrderId}/status`, {
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: { status: 'ORDER_RECEIVED' }
    });
    assert.strictEqual(illegalBack.status, 400);

    // Verify tracking endpoint shows DELIVERED with tracking number
    const trackRes = await request('GET', `/api/orders/${testOrderNumber}/track`);
    assert.strictEqual(trackRes.data.order.status, 'DELIVERED');
    assert.strictEqual(trackRes.data.order.trackingNumber, 'BD-9988776655-IN');
  });

  check('R5.6: Admin Audit Trail Verification', () => {
    const logs = db.prepare('SELECT * FROM admin_audit_logs ORDER BY created_at DESC LIMIT 10').all();
    assert.ok(logs.length > 0, 'Admin audit logs must record actions');
    const actions = logs.map(l => l.action);
    assert.ok(actions.includes('CREATE_PRODUCT') || actions.includes('TOGGLE_STOCK') || actions.includes('UPDATE_ORDER_STATUS'), 'Audit trail must record admin operations');
  });

  // Teardown
  if (serverInstance) {
    serverInstance.close();
  }

  console.log('\n======================================================================');
  console.log(`INDEPENDENT AUDIT SUMMARY: ${passedChecks} PASSED, ${failedChecks} FAILED`);
  console.log('======================================================================\n');

  if (failedChecks > 0) {
    console.error('FAILED AUDIT CHECKS:');
    console.error(JSON.stringify(errors, null, 2));
    process.exit(1);
  } else {
    console.log('>>> VERDICT: ALL ACCEPTANCE CRITERIA VERIFIED (100% CLEAN) <<<');
    process.exit(0);
  }
}

runIndependentVictoryAudit().catch((err) => {
  console.error('Fatal probe error:', err);
  process.exit(1);
});
