const http = require('http');
const crypto = require('crypto');
const app = require('../../src/app');
const { initializeDatabase, getDb } = require('../../src/config/database');
const { seedDatabase } = require('../../src/utils/seed');
const { generateTestSignature } = require('../../src/config/razorpay');

let server;
let port;
let baseUrl;

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const postData = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
    const reqHeaders = { ...headers };

    if (postData && !reqHeaders['Content-Type'] && !reqHeaders['content-type']) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(url, {
      method,
      headers: reqHeaders
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: json
        });
      });
    });

    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- STARTING BACKEND ENDPOINT VERIFICATION ---');
  await initializeDatabase();
  await seedDatabase();

  server = app.listen(0);
  port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;
  console.log(`Test server running at ${baseUrl}`);

  let passed = 0;
  let failed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${name}`);
      failed++;
    }
  }

  try {
    // 1. Health Check
    const healthRes = await request('GET', '/api/health');
    assert(healthRes.status === 200 && healthRes.body.status === 'ok', 'GET /api/health returns 200 OK');

    // 2. Product Catalog
    const productsRes = await request('GET', '/api/products');
    assert(productsRes.status === 200 && Array.isArray(productsRes.body.data) && productsRes.body.data.length >= 2, 'GET /api/products returns active products');
    const firstProd = productsRes.body.data.find(p => p.sku === 'SPT-001') || productsRes.body.data[0];
    assert(firstProd.sku === 'SPT-001' && firstProd.price === 699, 'SPT-001 has price 699');

    const singleProdRes = await request('GET', `/api/products/${firstProd.id}`);
    assert(singleProdRes.status === 200 && singleProdRes.body.data.sku === 'SPT-001', 'GET /api/products/:id returns single product');

    // 3. Customer Registration
    const testEmail = `customer_${Date.now()}@example.com`;
    const regRes = await request('POST', '/api/auth/register', {
      email: testEmail,
      password: 'Password123!',
      name: 'Test Customer',
      phone: '+919876543210'
    });
    assert(regRes.status === 201 && regRes.body.token && regRes.body.user.email === testEmail, 'POST /api/auth/register registers user');
    const customerToken = regRes.body.token;

    // 4. Duplicate Registration Defense
    const dupRegRes = await request('POST', '/api/auth/register', {
      email: testEmail,
      password: 'Password123!',
      name: 'Duplicate Customer'
    });
    assert(dupRegRes.status === 409, 'Duplicate registration returns 409 Conflict');

    // 5. Customer Login
    const loginRes = await request('POST', '/api/auth/login', {
      email: testEmail,
      password: 'Password123!'
    });
    assert(loginRes.status === 200 && loginRes.body.token, 'POST /api/auth/login succeeds');

    // 6. User Profile Introspection
    const meRes = await request('GET', '/api/auth/me', null, {
      'Authorization': `Bearer ${customerToken}`
    });
    assert(meRes.status === 200 && meRes.body.user.email === testEmail, 'GET /api/auth/me returns profile');

    // 7. Google OAuth Login
    const googleRes = await request('POST', '/api/auth/google', {
      email: `google_${Date.now()}@gmail.com`,
      name: 'Google User',
      googleId: `gid_${Date.now()}`
    });
    assert(googleRes.status === 200 && googleRes.body.token && googleRes.body.user.role === 'customer', 'POST /api/auth/google creates/logs in user');

    // 8. Admin Login
    const adminLoginRes = await request('POST', '/api/auth/admin/login', {
      email: 'admin@tunetagz.com',
      password: 'Admin@TuneTagZ2026!'
    });
    assert(adminLoginRes.status === 200 && adminLoginRes.body.user.role === 'admin', 'POST /api/auth/admin/login returns admin JWT');
    const adminToken = adminLoginRes.body.token;

    // 9. Spotify Customizer Link Parsing
    const spotifyRes = await request('GET', '/api/spotify/preview?url=https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT');
    assert(spotifyRes.status === 200 && spotifyRes.body.spotify.isValid && spotifyRes.body.svg.includes('<svg'), 'GET /api/spotify/preview parses Spotify URI & returns SVG');

    // 10. Order Placement with Customization & Price Tampering Defense
    const orderRes = await request('POST', '/api/orders', {
      items: [
        {
          productId: firstProd.id,
          quantity: 2,
          price: 1, // Tampered client price — must be ignored!
          customization: {
            spotifyUrl: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
            songTitle: 'Starboy',
            artistName: 'The Weeknd',
            customText: 'Amal & Sara'
          }
        }
      ],
      customer: {
        name: 'Test Customer',
        email: testEmail,
        phone: '+919876543210'
      },
      shippingAddress: {
        addressLine1: '123 MG Road',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560001'
      }
    }, {
      'Authorization': `Bearer ${customerToken}`
    });
    assert(orderRes.status === 201 && orderRes.body.order.totalAmount === 1398, 'POST /api/orders enforces DB price (699 x 2 = 1398, ignores tampered price 1)');
    const orderId = orderRes.body.order.id;
    const orderNumber = orderRes.body.order.orderNumber;

    // 11. Boundary: Custom text > 30 chars
    const longTextOrderRes = await request('POST', '/api/orders', {
      items: [{ productId: firstProd.id, quantity: 1, customization: { customText: 'This text is definitely way longer than thirty characters!' } }],
      customer: { name: 'A', email: testEmail },
      shippingAddress: { addressLine1: 'A', city: 'B', state: 'C', postalCode: '560001' }
    });
    assert(longTextOrderRes.status === 400, 'Custom text > 30 chars rejected with 400 Bad Request');

    // 12. Razorpay Order Creation
    const payOrderRes = await request('POST', '/api/payments/create-order', {
      orderId: orderId
    });
    assert(payOrderRes.status === 201 && payOrderRes.body.razorpayOrderId && payOrderRes.body.amount === 139800, 'POST /api/payments/create-order creates Razorpay order with amount in paise');
    const rzpOrderId = payOrderRes.body.razorpayOrderId;

    // 13. Invalid Signature Tamper Defense
    const invalidVerifyRes = await request('POST', '/api/payments/verify', {
      orderId: orderId,
      razorpay_order_id: rzpOrderId,
      razorpay_payment_id: 'pay_test123',
      razorpay_signature: 'invalid_forged_signature_hex'
    });
    assert(invalidVerifyRes.status === 400, 'Invalid payment signature rejected with 400 Bad Request');

    // 14. Valid Payment Verification
    const paymentId = `pay_${Date.now()}`;
    const validSignature = generateTestSignature(rzpOrderId, paymentId);
    const validVerifyRes = await request('POST', '/api/payments/verify', {
      orderId: orderId,
      razorpay_order_id: rzpOrderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: validSignature
    });
    assert(validVerifyRes.status === 200 && validVerifyRes.body.status === 'ORDER_RECEIVED', 'POST /api/payments/verify verifies HMAC & transitions order to ORDER_RECEIVED');

    // 15. Live Tracking API
    const trackRes = await request('GET', `/api/orders/${orderNumber}/track`);
    assert(trackRes.status === 200 && trackRes.body.order.status === 'ORDER_RECEIVED' && Array.isArray(trackRes.body.order.timeline), 'GET /api/orders/:orderId/track returns live tracking');

    // 16. Customer Order History
    const myOrdersRes = await request('GET', '/api/orders/my-orders', null, {
      'Authorization': `Bearer ${customerToken}`
    });
    assert(myOrdersRes.status === 200 && myOrdersRes.body.data.length >= 1, 'GET /api/orders/my-orders returns customer orders');

    // 17. Admin KPI Stats
    const statsRes = await request('GET', '/api/admin/stats', null, {
      'Authorization': `Bearer ${adminToken}`
    });
    assert(statsRes.status === 200 && statsRes.body.totalRevenue >= 1398, 'GET /api/admin/stats returns KPIs & revenue');

    // 18. Admin Order Fulfillment Status Advance
    const advanceRes = await request('PATCH', `/api/admin/orders/${orderId}/status`, {
      status: 'ENGRAVING'
    }, {
      'Authorization': `Bearer ${adminToken}`
    });
    assert(advanceRes.status === 200 && advanceRes.body.order.status === 'ENGRAVING', 'PATCH /api/admin/orders/:id/status advances to ENGRAVING');

    const dispatchRes = await request('PATCH', `/api/admin/orders/${orderId}/status`, {
      status: 'DISPATCHED',
      courierName: 'Delhivery',
      trackingNumber: 'DLH-99887766'
    }, {
      'Authorization': `Bearer ${adminToken}`
    });
    assert(dispatchRes.status === 200 && dispatchRes.body.order.status === 'DISPATCHED' && dispatchRes.body.order.trackingNumber === 'DLH-99887766', 'PATCH status to DISPATCHED saves courier info');

    // 19. Illegal State Transition Defense
    const illegalTransitionRes = await request('PATCH', `/api/admin/orders/${orderId}/status`, {
      status: 'PENDING_PAYMENT'
    }, {
      'Authorization': `Bearer ${adminToken}`
    });
    assert(illegalTransitionRes.status === 400, 'Illegal transition (DISPATCHED -> PENDING_PAYMENT) rejected with 400');

    // 20. Admin Stock Toggle
    const stockRes = await request('PATCH', `/api/admin/products/${firstProd.id}/stock`, {
      inStock: false
    }, {
      'Authorization': `Bearer ${adminToken}`
    });
    assert(stockRes.status === 200 && stockRes.body.inStock === false, 'PATCH /api/admin/products/:id/stock toggles stock');

    // Restore stock
    await request('PATCH', `/api/admin/products/${firstProd.id}/stock`, { inStock: true }, { 'Authorization': `Bearer ${adminToken}` });

    // 21. Payment Webhook Ingestion
    const webhookOrderId = `order_wh_${Date.now()}`;
    const webhookRes = await request('POST', '/api/payments/webhook', {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: `pay_wh_${Date.now()}`,
            order_id: webhookOrderId,
            method: 'upi'
          }
        }
      }
    });
    assert(webhookRes.status === 200 && webhookRes.body.status === 'ok', 'POST /api/payments/webhook handles webhook events cleanly');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    server.close();
    console.log(`\n--- TEST RESULTS: ${passed} PASSED, ${failed} FAILED ---`);
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
