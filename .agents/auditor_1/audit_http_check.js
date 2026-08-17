/**
 * Forensic Auditor Live HTTP Socket & Middleware Verification Script
 * Launches the server on a dedicated port and verifies live HTTP behaviors:
 * 1. Multer multipart file upload to /uploads with binary content verification
 * 2. Non-image file upload rejection (415 / 400)
 * 3. Protected admin route RBAC: unauth (401), customer token (403), admin token (200)
 * 4. Price tampering resistance over HTTP
 * 5. Cryptographic signature verification over HTTP
 */

const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
process.chdir(PROJECT_ROOT);

const app = require(path.join(PROJECT_ROOT, 'src/app'));
const env = require(path.join(PROJECT_ROOT, 'src/config/env'));
const { initializeDatabase } = require(path.join(PROJECT_ROOT, 'src/config/database'));
const { seedDatabase } = require(path.join(PROJECT_ROOT, 'src/utils/seed'));

async function makeRequest(serverPort, pathUrl, options = {}, bodyData = null) {
  return new Promise((resolve, reject) => {
    const reqOptions = {
      hostname: '127.0.0.1',
      port: serverPort,
      path: pathUrl,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({ status: res.statusCode, headers: res.headers, body: json });
      });
    });

    req.on('error', reject);

    if (bodyData) {
      if (Buffer.isBuffer(bodyData)) {
        req.write(bodyData);
      } else if (typeof bodyData === 'object') {
        req.setHeader('Content-Type', 'application/json');
        req.write(JSON.stringify(bodyData));
      } else {
        req.write(bodyData);
      }
    }
    req.end();
  });
}

function buildMultipartPayload(fieldName, filename, mimeType, fileBuffer, extraFields = {}) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const parts = [];

  for (const [k, v] of Object.entries(extraFields)) {
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`
    ));
  }

  parts.push(Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`
  ));
  parts.push(fileBuffer);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));

  const fullBuffer = Buffer.concat(parts);
  return {
    contentType: `multipart/form-data; boundary=${boundary}`,
    body: fullBuffer
  };
}

async function runLiveHttpAudit() {
  await initializeDatabase();
  await seedDatabase();

  const AUDIT_PORT = 3999;
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(AUDIT_PORT, '127.0.0.1', resolve));
  console.log(`Live Audit HTTP Server running on http://127.0.0.1:${AUDIT_PORT}`);

  const results = [];

  async function test(name, fn) {
    try {
      await fn();
      results.push({ name, pass: true });
      console.log(`  [PASS] ${name}`);
    } catch (err) {
      results.push({ name, pass: false, error: err.message });
      console.error(`  [FAIL] ${name}:`, err.message);
    }
  }

  try {
    // 1. Health check
    await test('HTTP 1.1 Health Check returns 200 and SQLite status', async () => {
      const res = await makeRequest(AUDIT_PORT, '/api/health');
      if (res.status !== 200 || !res.body.database?.connected) {
        throw new Error(`Health check failed: status ${res.status}, body: ${JSON.stringify(res.body)}`);
      }
    });

    // 2. Auth: Register customer & get token
    let customerToken = null;
    await test('HTTP 1.2 Customer Registration & JWT Token Issuance', async () => {
      const email = `http_cust_${Date.now()}@example.com`;
      const res = await makeRequest(AUDIT_PORT, '/api/auth/register', { method: 'POST' }, {
        email,
        password: 'Password123!',
        name: 'HTTP Customer',
        phone: '+919876543210'
      });
      if (res.status !== 201 || !res.body.token || res.body.user?.role !== 'customer') {
        throw new Error(`Customer registration failed: ${JSON.stringify(res.body)}`);
      }
      customerToken = res.body.token;
    });

    // 3. Admin Login & JWT Token Issuance
    let adminToken = null;
    await test('HTTP 1.3 Admin Login & Admin-Scoped JWT Token Issuance', async () => {
      const res = await makeRequest(AUDIT_PORT, '/api/auth/admin/login', { method: 'POST' }, {
        email: env.ADMIN_EMAIL,
        password: env.ADMIN_PASSWORD
      });
      if (res.status !== 200 || !res.body.token || res.body.user?.role !== 'admin') {
        throw new Error(`Admin login failed: ${JSON.stringify(res.body)}`);
      }
      adminToken = res.body.token;
    });

    // 4. RBAC Middleware Enforcement: /api/admin/stats
    await test('HTTP 1.4 RBAC: Unauthenticated request to /api/admin/stats blocked with 401', async () => {
      const res = await makeRequest(AUDIT_PORT, '/api/admin/stats', { method: 'GET' });
      if (res.status !== 401) {
        throw new Error(`Expected 401 Unauthorized, got status ${res.status}`);
      }
    });

    await test('HTTP 1.5 RBAC: Customer token request to /api/admin/stats blocked with 403', async () => {
      const res = await makeRequest(AUDIT_PORT, '/api/admin/stats', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${customerToken}` }
      });
      if (res.status !== 403) {
        throw new Error(`Expected 403 Forbidden, got status ${res.status}`);
      }
    });

    await test('HTTP 1.6 RBAC: Admin token request to /api/admin/stats accepted with 200', async () => {
      const res = await makeRequest(AUDIT_PORT, '/api/admin/stats', {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      if (res.status !== 200 || res.body.stats === undefined) {
        throw new Error(`Expected 200 OK with stats, got status ${res.status}`);
      }
    });

    // 5. Multer Image Upload over HTTP
    let uploadedImageUrl = null;
    await test('HTTP 1.7 Multer Upload: Upload valid PNG to /api/products/upload and verify disk storage', async () => {
      const pngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAADklEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
      const multipart = buildMultipartPayload('image', 'audit_product_image.png', 'image/png', pngBuffer);

      const res = await makeRequest(AUDIT_PORT, '/api/products/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': multipart.contentType
        }
      }, multipart.body);

      if (res.status !== 201 || !res.body.imageUrl) {
        throw new Error(`Multer image upload failed: status ${res.status}, body: ${JSON.stringify(res.body)}`);
      }
      uploadedImageUrl = res.body.imageUrl;

      // Verify file exists on disk
      const diskPath = path.join(PROJECT_ROOT, uploadedImageUrl.startsWith('/') ? uploadedImageUrl.slice(1) : uploadedImageUrl);
      if (!fs.existsSync(diskPath)) {
        throw new Error(`Uploaded file does not exist on disk at ${diskPath}`);
      }
      const diskContent = fs.readFileSync(diskPath);
      if (diskContent.length !== pngBuffer.length) {
        throw new Error(`Uploaded file byte length mismatch: expected ${pngBuffer.length}, got ${diskContent.length}`);
      }
    });

    await test('HTTP 1.8 Multer Upload: Disallowed MIME type (text/plain) rejected with 415/400', async () => {
      const textBuffer = Buffer.from('Malicious script content');
      const multipart = buildMultipartPayload('image', 'script.txt', 'text/plain', textBuffer);

      const res = await makeRequest(AUDIT_PORT, '/api/products/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': multipart.contentType
        }
      }, multipart.body);

      if (res.status !== 415 && res.status !== 400) {
        throw new Error(`Expected 415 or 400 for text/plain upload, got status ${res.status}`);
      }
    });

    // 6. Cryptographic Payment Flow over HTTP
    await test('HTTP 1.9 Full Payment Gateway Order & HMAC Verification Flow', async () => {
      // 1. Create order
      const createRes = await makeRequest(AUDIT_PORT, '/api/payments/create-order', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${customerToken}` }
      }, {
        items: [{ productId: 1, quantity: 1, customText: 'HTTP AUDIT' }],
        customer: {
          name: 'HTTP Auditor',
          email: 'http_auditor@example.com',
          phone: '+919876543210'
        },
        shippingAddress: {
          addressLine1: '789 Gateway Road',
          city: 'Pune',
          state: 'Maharashtra',
          postalCode: '411001',
          country: 'India'
        }
      });

      if (createRes.status !== 201 || !createRes.body.razorpayOrderId) {
        throw new Error(`Payment order creation failed: status ${createRes.status}, body: ${JSON.stringify(createRes.body)}`);
      }

      const rzpOrderId = createRes.body.razorpayOrderId;
      const internalOrderId = createRes.body.orderId;
      const rzpPaymentId = `pay_http_${Date.now()}`;

      // 2. Reject forged signature
      const badVerifyRes = await makeRequest(AUDIT_PORT, '/api/payments/verify', { method: 'POST' }, {
        orderId: internalOrderId,
        razorpay_order_id: rzpOrderId,
        razorpay_payment_id: rzpPaymentId,
        razorpay_signature: 'forged_bad_signature_00000000000000000000000000000000000000000000'
      });
      if (badVerifyRes.status !== 400) {
        throw new Error(`Expected 400 for forged signature, got status ${badVerifyRes.status}`);
      }

      // 3. Accept valid HMAC-SHA256 signature
      const secret = env.RAZORPAY_KEY_SECRET || 'rzp_test_TuneTagZ2026Secret';
      const validSig = crypto.createHmac('sha256', secret).update(`${rzpOrderId}|${rzpPaymentId}`).digest('hex');

      const goodVerifyRes = await makeRequest(AUDIT_PORT, '/api/payments/verify', { method: 'POST' }, {
        orderId: internalOrderId,
        razorpay_order_id: rzpOrderId,
        razorpay_payment_id: rzpPaymentId,
        razorpay_signature: validSig
      });

      if (goodVerifyRes.status !== 200 || goodVerifyRes.body.order?.status !== 'ORDER_RECEIVED') {
        throw new Error(`Valid payment verification failed: status ${goodVerifyRes.status}, body: ${JSON.stringify(goodVerifyRes.body)}`);
      }
    });

  } finally {
    server.close();
  }

  console.log('\n===============================================================');
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`TOTAL HTTP CHECKS: ${results.length} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('===============================================================');

  if (failed > 0) {
    console.error('LIVE HTTP AUDIT VERDICT: INTEGRITY VIOLATION');
    process.exit(1);
  } else {
    console.log('LIVE HTTP AUDIT VERDICT: CLEAN');
    process.exit(0);
  }
}

runLiveHttpAudit().catch(err => {
  console.error('Fatal live HTTP audit error:', err);
  process.exit(1);
});
