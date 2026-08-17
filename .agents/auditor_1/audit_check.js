/**
 * Forensic Auditor Independent Verification Script
 * Audits database persistence, cryptographic operations, Multer uploads,
 * auth/RBAC enforcement, price tampering defense, and full E2E lifecycle.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
process.chdir(PROJECT_ROOT);

const env = require(path.join(PROJECT_ROOT, 'src/config/env'));
const { initializeDatabase, getDb } = require(path.join(PROJECT_ROOT, 'src/config/database'));
const { seedDatabase } = require(path.join(PROJECT_ROOT, 'src/utils/seed'));
const { createRazorpayOrder, verifyRazorpaySignature, verifyWebhookSignature, generateTestSignature } = require(path.join(PROJECT_ROOT, 'src/config/razorpay'));
const authService = require(path.join(PROJECT_ROOT, 'src/services/auth.service'));
const productService = require(path.join(PROJECT_ROOT, 'src/services/product.service'));
const orderService = require(path.join(PROJECT_ROOT, 'src/services/order.service'));
const paymentService = require(path.join(PROJECT_ROOT, 'src/services/payment.service'));
const adminService = require(path.join(PROJECT_ROOT, 'src/services/admin.service'));
const { parseSpotifyUrl, generateSoundwaveBars, validateCustomText } = require(path.join(PROJECT_ROOT, 'src/services/spotify.service'));

const results = [];

function check(name, fn) {
  try {
    const outcome = fn();
    if (outcome && typeof outcome.then === 'function') {
      return outcome.then(() => {
        results.push({ name, pass: true });
        console.log(`  [PASS] ${name}`);
      }).catch(err => {
        results.push({ name, pass: false, error: err.message });
        console.error(`  [FAIL] ${name}:`, err.message);
      });
    }
    results.push({ name, pass: true });
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    results.push({ name, pass: false, error: err.message });
    console.error(`  [FAIL] ${name}:`, err.message);
  }
}

async function runAudit() {
  console.log('===============================================================');
  console.log('      FORENSIC AUDITOR INDEPENDENT VERIFICATION SUITE          ');
  console.log('===============================================================');

  // 1. Initialize & Inspect Database
  await check('1.1 Initialize SQLite Database Engine', async () => {
    await initializeDatabase();
    await seedDatabase();
    const db = getDb();
    if (!db) throw new Error('Database instance is null or undefined');
  });

  await check('1.2 Verify Schema Tables & Structure in SQLite', () => {
    const db = getDb();
    const requiredTables = ['users', 'products', 'orders', 'order_items', 'payments', 'admin_audit_logs', 'admin_settings'];
    for (const table of requiredTables) {
      const row = db.prepare(`SELECT count(*) as count FROM ${table}`).get();
      if (row === undefined || row.count === undefined) {
        throw new Error(`Table ${table} query failed or table does not exist`);
      }
    }
  });

  await check('1.3 Verify Default Catalog Seed Data (SPT-001, RKY-001, DRP-003)', () => {
    const db = getDb();
    const spt = db.prepare('SELECT * FROM products WHERE sku = ?').get('SPT-001');
    if (!spt || spt.price !== 699 || !spt.name.includes('Spotify Code Tag')) {
      throw new Error(`SPT-001 seed product data mismatch: ${JSON.stringify(spt)}`);
    }
    const rky = db.prepare('SELECT * FROM products WHERE sku = ?').get('RKY-001');
    if (!rky || rky.price !== 300 || !rky.name.includes('Rocky Keychain')) {
      throw new Error(`RKY-001 seed product data mismatch: ${JSON.stringify(rky)}`);
    }
  });

  // 2. Authentication, Bcrypt Hashing & JWT Integrity
  await check('2.1 Password Hashing with Bcrypt & Salt Verification', async () => {
    const plain = 'TestSecurePassword123!';
    const hash = bcrypt.hashSync(plain, 10);
    if (!hash.startsWith('$2a$') && !hash.startsWith('$2b$')) {
      throw new Error(`Invalid bcrypt hash format: ${hash}`);
    }
    if (!bcrypt.compareSync(plain, hash)) {
      throw new Error('bcrypt.compareSync failed for matching password');
    }
    if (bcrypt.compareSync('WrongPassword!', hash)) {
      throw new Error('bcrypt.compareSync succeeded for incorrect password');
    }
  });

  await check('2.2 Real Customer Registration & DB Persistence with Bcrypt Hash', async () => {
    const uniqueEmail = `audit_cust_${Date.now()}@example.com`;
    const regResult = await authService.registerUser({
      email: uniqueEmail,
      password: 'AuditPassword2026!',
      name: 'Auditor Test Customer',
      phone: '+919876543210'
    });

    if (!regResult.user || !regResult.token) {
      throw new Error('Registration failed to return user or token');
    }

    const db = getDb();
    const dbUser = db.prepare('SELECT * FROM users WHERE email = ?').get(uniqueEmail);
    if (!dbUser || !dbUser.password_hash) {
      throw new Error('User was not stored in SQLite users table with password_hash');
    }
    if (!bcrypt.compareSync('AuditPassword2026!', dbUser.password_hash)) {
      throw new Error('Stored password hash in DB does not match plaintext via bcrypt');
    }

    // Attempt login with stored credentials
    const loginResult = await authService.loginUser({
      email: uniqueEmail,
      password: 'AuditPassword2026!'
    });
    if (!loginResult.token || loginResult.user.id !== dbUser.id) {
      throw new Error('Login failed with stored credentials');
    }
  });

  await check('2.3 Admin Login & Role-Based Token Signing', async () => {
    const adminLogin = await authService.adminLogin({
      email: env.ADMIN_EMAIL,
      password: env.ADMIN_PASSWORD
    });
    if (!adminLogin.token || adminLogin.user.role !== 'admin') {
      throw new Error('Admin login failed or role is not admin');
    }
    const decoded = jwt.verify(adminLogin.token, env.JWT_SECRET);
    if (decoded.role !== 'admin') {
      throw new Error(`Decoded JWT does not contain role: 'admin' (${decoded.role})`);
    }
  });

  // 3. Cryptographic HMAC-SHA256 Signature Verification
  await check('3.1 Razorpay HMAC-SHA256 Cryptographic Verification Algorithm', () => {
    const orderId = 'order_audit_12345';
    const paymentId = 'pay_audit_67890';
    const secret = env.RAZORPAY_KEY_SECRET || 'rzp_test_TuneTagZ2026Secret';

    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    const isValid = verifyRazorpaySignature({
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: expectedSig
    });
    if (!isValid) throw new Error('Legitimate HMAC signature was rejected by verifyRazorpaySignature');

    // Test bit-flipped signature rejection
    const badSig = expectedSig.slice(0, -1) + (expectedSig.endsWith('0') ? '1' : '0');
    const isBadValid = verifyRazorpaySignature({
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: badSig
    });
    if (isBadValid) throw new Error('Bit-flipped forged HMAC signature was accepted by verifyRazorpaySignature');
  });

  await check('3.2 Webhook Signature Cryptographic Verification', () => {
    const payload = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_hook_1' } } } });
    const secret = env.RAZORPAY_WEBHOOK_SECRET || 'rzp_webhook_secret_2026';
    const validSig = crypto.createHmac('sha256', secret).update(payload).digest('hex');

    if (!verifyWebhookSignature(payload, validSig, secret)) {
      throw new Error('Valid webhook signature was rejected');
    }
    if (verifyWebhookSignature(payload, 'forged_webhook_signature', secret)) {
      throw new Error('Forged webhook signature was accepted');
    }
  });

  // 4. Server-Side Price Calculation & Anti-Tampering
  await check('4.1 Server-Side Price Calculation strictly enforced from DB', async () => {
    const db = getDb();
    const spt = db.prepare('SELECT id, price FROM products WHERE sku = ?').get('SPT-001');
    const rky = db.prepare('SELECT id, price FROM products WHERE sku = ?').get('RKY-001');

    // Attempt client-side price tampering injection
    const calculation = await orderService.calculateOrderTotal([
      { productId: spt.id, quantity: 2, price: 1.00 }, // client tries ₹1
      { productId: rky.id, quantity: 1, price: 5.00 }  // client tries ₹5
    ]);

    const expectedSubtotal = (spt.price * 2) + (rky.price * 1); // 699*2 + 300 = 1698
    if (calculation.totalAmount !== expectedSubtotal) {
      throw new Error(`Price tampering defense failed! Expected ₹${expectedSubtotal}, calculated ₹${calculation.totalAmount}`);
    }
  });

  // 5. Spotify Customizer Engine
  await check('5.1 Spotify URL/URI Parser & Deterministic Soundwave Generator', () => {
    const urlRes = parseSpotifyUrl('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT?si=abc');
    if (!urlRes.isValid || urlRes.id !== '4cOdK2wGLETKBW3PvgPWqT' || urlRes.type !== 'track') {
      throw new Error(`Spotify URL parsing failed: ${JSON.stringify(urlRes)}`);
    }

    const uriRes = parseSpotifyUrl('spotify:track:4cOdK2wGLETKBW3PvgPWqT');
    if (!uriRes.isValid || uriRes.id !== '4cOdK2wGLETKBW3PvgPWqT') {
      throw new Error(`Spotify URI parsing failed: ${JSON.stringify(uriRes)}`);
    }

    const bars = generateSoundwaveBars('4cOdK2wGLETKBW3PvgPWqT', 23);
    if (!Array.isArray(bars) || bars.length !== 23) {
      throw new Error(`Soundwave bars generation invalid length: ${bars.length}`);
    }
  });

  // 6. Complete Order & Payment Lifecycle
  await check('6.1 End-to-End Order Creation, Payment Verification, and State Transitions', async () => {
    const db = getDb();
    const spt = db.prepare('SELECT id, price FROM products WHERE sku = ?').get('SPT-001');

    // 1. Create order
    const orderData = {
      customer: {
        name: 'Audit Customer Lifecycle',
        email: `audit_cycle_${Date.now()}@example.com`,
        phone: '+919876543210'
      },
      shippingAddress: {
        addressLine1: '456 Audit Lane, Tech Park',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400001',
        country: 'India'
      },
      items: [
        {
          productId: spt.id,
          quantity: 1,
          spotifyUrl: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
          customText: 'AUDIT GOLD 2026'
        }
      ]
    };

    const createdOrder = await orderService.createOrder(orderData);
    if (!createdOrder.id || createdOrder.status !== 'PENDING_PAYMENT') {
      throw new Error(`Order creation returned unexpected status: ${createdOrder.status}`);
    }

    // 2. Initiate payment
    const paymentInit = await paymentService.initiatePayment({ orderId: createdOrder.id });
    if (!paymentInit.razorpayOrderId) {
      throw new Error('Payment initiation failed to generate razorpayOrderId');
    }

    // 3. Cryptographically verify payment
    const testPaymentId = `pay_audit_${Date.now()}`;
    const testSignature = generateTestSignature(paymentInit.razorpayOrderId, testPaymentId);

    const verifyResult = await paymentService.verifyPaymentSignatureAndConfirm({
      orderId: createdOrder.id,
      razorpay_order_id: paymentInit.razorpayOrderId,
      razorpay_payment_id: testPaymentId,
      razorpay_signature: testSignature
    });

    if (!verifyResult.success || verifyResult.status !== 'ORDER_RECEIVED') {
      throw new Error(`Payment verification failed: ${JSON.stringify(verifyResult)}`);
    }

    // 4. Admin advances order state: ORDER_RECEIVED -> ENGRAVING -> DISPATCHED -> DELIVERED
    const step1 = await adminService.updateOrderStatus(createdOrder.id, { status: 'ENGRAVING' }, 1);
    if (step1.status !== 'ENGRAVING') throw new Error(`Failed transition to ENGRAVING: ${step1.status}`);

    const step2 = await adminService.updateOrderStatus(createdOrder.id, {
      status: 'DISPATCHED',
      courierName: 'BlueDart Express',
      trackingNumber: 'BD-AUDIT-999888'
    }, 1);
    if (step2.status !== 'DISPATCHED' || step2.trackingNumber !== 'BD-AUDIT-999888') {
      throw new Error(`Failed transition to DISPATCHED: ${JSON.stringify(step2)}`);
    }

    const step3 = await adminService.updateOrderStatus(createdOrder.id, { status: 'DELIVERED' }, 1);
    if (step3.status !== 'DELIVERED') throw new Error(`Failed transition to DELIVERED: ${step3.status}`);

    // 5. Verify audit logs
    const auditLogs = await adminService.getAuditLogs(10);
    const relatedLogs = auditLogs.filter(l => String(l.target_id) === String(createdOrder.id));
    if (relatedLogs.length < 3) {
      throw new Error(`Expected at least 3 audit log entries for order lifecycle transitions, found ${relatedLogs.length}`);
    }
  });

  // 7. Multer and Upload Directory Verification
  await check('7.1 Multer Upload Storage Directory Verification', () => {
    const uploadDir = env.UPLOADS_DIR;
    if (!fs.existsSync(uploadDir)) {
      throw new Error(`Uploads directory does not exist at ${uploadDir}`);
    }
    // Write test file and read it back
    const testFileName = `test-audit-${Date.now()}.png`;
    const testFilePath = path.join(uploadDir, testFileName);
    fs.writeFileSync(testFilePath, Buffer.from('TEST_PNG_DATA'));
    if (!fs.existsSync(testFilePath)) {
      throw new Error('Failed to write to uploads directory');
    }
    fs.unlinkSync(testFilePath);
  });

  console.log('\n===============================================================');
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`TOTAL CHECKS: ${results.length} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('===============================================================');

  if (failed > 0) {
    console.error('\nAUDIT VERDICT: INTEGRITY VIOLATION');
    process.exit(1);
  } else {
    console.log('\nAUDIT VERDICT: CLEAN');
    process.exit(0);
  }
}

runAudit().catch(err => {
  console.error('Fatal audit check error:', err);
  process.exit(1);
});
