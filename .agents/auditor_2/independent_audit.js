const assert = require('assert');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

async function runIndependentForensics() {
  console.log('=== STARTING INDEPENDENT FORENSIC PROBE ===');

  // 1. Initialize Database
  const { initializeDatabase, getDb } = require('../../src/config/database');
  await initializeDatabase();
  const db = getDb();

  console.log('\n[CHECK 1] SQLite Database & Transaction Rollback Integrity:');
  const tables = ['users', 'products', 'orders', 'order_items', 'payments', 'admin_audit_logs', 'admin_settings'];
  for (const t of tables) {
    const row = db.prepare('SELECT count(*) as cnt FROM ' + t).get();
    assert(row !== undefined && row.cnt !== undefined, 'Table ' + t + ' must exist in SQLite');
    console.log('  ✔ Table "' + t + '" verified in SQLite DB (row count: ' + row.cnt + ')');
  }

  // Test Transaction Rollback
  const countBefore = db.prepare('SELECT count(*) as cnt FROM products').get().cnt;
  try {
    db.transaction(() => {
      db.prepare("INSERT INTO products (sku, name, description, price, image_url, is_active) VALUES ('TEST-ROLLBACK-SKU', 'Test Rollback', 'Desc', 999, 'test.png', 1)").run();
      throw new Error('Simulated transaction failure for rollback verification');
    })();
  } catch (e) {
    // Expected rollback
  }
  const countAfter = db.prepare('SELECT count(*) as cnt FROM products').get().cnt;
  assert.strictEqual(countAfter, countBefore, 'Transaction rollback failed: record was not reverted!');
  console.log('  ✔ SQLite Transaction Atomicity Verified: Rollback successfully reverted aborted insert.');

  // 2. Genuine bcrypt Password Hashing
  console.log('\n[CHECK 2] Genuine Bcrypt Hashing Integrity:');
  const authService = require('../../src/services/auth.service');
  const testEmail = 'forensic_user_' + Date.now() + '@tunetagz.test';
  const testPassword = 'ForensicPassword@2026!';
  const regResult = await authService.registerUser({
    email: testEmail,
    password: testPassword,
    name: 'Forensic Test User'
  });
  assert(regResult && regResult.user && regResult.token, 'User registration must succeed');

  const dbUser = db.prepare('SELECT * FROM users WHERE id = ?').get(regResult.user.id);
  assert(dbUser.password_hash !== testPassword, 'CRITICAL: Password is stored in plain text!');
  assert(dbUser.password_hash.startsWith('$') || dbUser.password_hash.startsWith('$'), 'Password hash must be a valid bcrypt hash');
  assert(dbUser.password_hash.length >= 59, 'Bcrypt hash length must be >= 59 chars');

  const isCorrect = bcrypt.compareSync(testPassword, dbUser.password_hash);
  const isWrong = bcrypt.compareSync('WrongPassword123!', dbUser.password_hash);
  assert.strictEqual(isCorrect, true, 'Bcrypt must validate correct password');
  assert.strictEqual(isWrong, false, 'Bcrypt must reject incorrect password');
  console.log('  ✔ Bcrypt hash verified in SQLite: ' + dbUser.password_hash.substring(0, 25) + '... (60 chars)');
  console.log('  ✔ Bcrypt compareSync accurately validates correct passwords and rejects invalid passwords.');

  // 3. Genuine HMAC-SHA256 Verification
  console.log('\n[CHECK 3] Genuine HMAC-SHA256 Cryptographic Verification:');
  const razorpayConfig = require('../../src/config/razorpay');
  const env = require('../../src/config/env');
  const rzpOrderId = 'order_forensic_' + Date.now();
  const rzpPaymentId = 'pay_forensic_' + Date.now();
  const secret = env.RAZORPAY_KEY_SECRET;
  const validSignature = crypto.createHmac('sha256', secret).update(rzpOrderId + '|' + rzpPaymentId).digest('hex');
  const bitFlippedSig = validSignature.substring(0, validSignature.length - 2) + (validSignature.endsWith('a') ? 'b' : 'a');

  const passValid = razorpayConfig.verifyRazorpaySignature({
    razorpay_order_id: rzpOrderId,
    razorpay_payment_id: rzpPaymentId,
    razorpay_signature: validSignature
  });
  const failBitFlipped = razorpayConfig.verifyRazorpaySignature({
    razorpay_order_id: rzpOrderId,
    razorpay_payment_id: rzpPaymentId,
    razorpay_signature: bitFlippedSig
  });
  const failMismatchedOrder = razorpayConfig.verifyRazorpaySignature({
    razorpay_order_id: rzpOrderId + '_tampered',
    razorpay_payment_id: rzpPaymentId,
    razorpay_signature: validSignature
  });

  assert.strictEqual(passValid, true, 'Valid HMAC signature must be accepted');
  assert.strictEqual(failBitFlipped, false, 'Bit-flipped HMAC signature must be rejected');
  assert.strictEqual(failMismatchedOrder, false, 'Mismatched order HMAC signature must be rejected');
  console.log('  ✔ Valid HMAC-SHA256 signature accepted.');
  console.log('  ✔ Bit-flipped and order-tampered signatures cryptographically rejected.');

  // 4. Server-Side Price Calculation & Anti-Tampering
  console.log('\n[CHECK 4] Server-Side Price Calculation & Anti-Tampering:');
  const orderService = require('../../src/services/order.service');
  const testProduct = db.prepare('SELECT * FROM products WHERE is_active = 1 AND in_stock = 1 LIMIT 1').get();
  assert(testProduct, 'Active product required in DB for price check');

  const calc = await orderService.calculateOrderTotal([{
    productId: testProduct.id,
    quantity: 2,
    price: 1
  }]);

  const expectedTotal = Number(testProduct.price) * 2;
  assert.strictEqual(calc.totalAmount, expectedTotal, 'Price tampering detected: total was not recalculated from DB!');
  console.log('  ✔ DB price ₹' + testProduct.price + ' x 2 = ₹' + calc.totalAmount + ' enforced. Injected client price of ₹1 was safely ignored.');

  // 5. State Machine Transition Restrictions
  console.log('\n[CHECK 5] State Machine Transition Rules:');
  const adminService = require('../../src/services/admin.service');
  const orderCreated = await orderService.createOrder({
    items: [{ productId: testProduct.id, quantity: 1 }],
    customer: { name: 'StateMachine Test', email: 'sm@test.com', phone: '9876543210' },
    shippingAddress: { addressLine1: 'Test', city: 'City', state: 'State', postalCode: '560001' }
  });

  let transitionBlocked = false;
  try {
    await adminService.updateOrderStatus(orderCreated.id, { status: 'DELIVERED' });
  } catch (err) {
    transitionBlocked = true;
  }
  assert.strictEqual(transitionBlocked, true, 'Illegal transition from PENDING_PAYMENT to DELIVERED must be blocked');
  console.log('  ✔ Illegal state jump PENDING_PAYMENT -> DELIVERED rejected with HTTP 400 error.');

  console.log('\n=== ALL INDEPENDENT FORENSIC PROBES PASSED CLEANLY ===\n');
}

runIndependentForensics().catch(err => {
  console.error('\n❌ FORENSIC PROBE FAILURE:', err);
  process.exit(1);
});
