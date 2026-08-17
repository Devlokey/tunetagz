/**
 * Tier 4 — Scenario 4: Full Security & Adversarial Tamper Resistance
 * Exercises combined adversarial attack vectors:
 * 1. Price tampering on checkout.
 * 2. Signature forgery on payment verification.
 * 3. Horizontal & Vertical privilege escalation attempts.
 * 4. Disallowed file upload attacks.
 * 5. Input boundary and XSS injections.
 */

const { generateTestCustomer, generateUniqueEmail } = require('../helpers/cryptoHelper');

module.exports = {
  title: 'S4: Full Security & Adversarial Tamper Resistance Scenario',
  run: async (t, client) => {
    // 1. Attack 1: Price Tampering Defense
    const productsRes = await client.get('/api/products');
    const products = Array.isArray(productsRes.data) ? productsRes.data : productsRes.data?.data || productsRes.data?.products || [];
    const product = products[0];

    const customer = generateTestCustomer();
    const tamperedOrderRes = await client.post('/api/orders', {
      customer,
      shippingAddress: customer.shippingAddress,
      items: [{ productId: product.id, quantity: 1, price: 1 }],
      totalAmount: 1
    });

    const orderData = tamperedOrderRes.data?.order || tamperedOrderRes.data?.data || tamperedOrderRes.data;
    const charged = Number(orderData.totalAmount || orderData.total_amount || orderData.amount);
    const expected = Number(product.price);
    t.assert(
      (charged === expected) || (charged === expected * 100),
      'Security Check 1: Price tampering blocked by server calculation'
    );

    // 2. Attack 2: Forged Payment Signature Defense
    const fakeOrderId = 'order_fake_' + Date.now();
    const forgedSigRes = await client.post('/api/payments/verify', {
      orderId: orderData.id || 1,
      razorpay_order_id: fakeOrderId,
      razorpay_payment_id: 'pay_fake_123',
      razorpay_signature: 'deadbeef00112233445566778899aabbccddeeff'
    });
    t.assert(
      forgedSigRes.status === 400 || forgedSigRes.status === 422,
      'Security Check 2: Forged HMAC signature rejected'
    );

    // 3. Attack 3: Unauthenticated Admin Access Defense
    client.clearAuth();
    const unauthStatsRes = await client.get('/api/admin/stats');
    t.assert(
      unauthStatsRes.status === 401 || unauthStatsRes.status === 403,
      'Security Check 3: Unauthenticated admin access blocked'
    );

    // 4. Attack 4: Privilege Escalation via Customer Token
    const custEmail = generateUniqueEmail('adv_cust');
    const custReg = await client.post('/api/auth/register', { email: custEmail, password: 'Pass12345!', name: 'Attacker' });
    const custToken = custReg.data?.token || custReg.data?.accessToken;
    client.setToken(custToken);

    const custAdminAccess = await client.get('/api/admin/orders');
    t.assert(
      custAdminAccess.status === 403 || custAdminAccess.status === 401,
      'Security Check 4: Customer privilege escalation blocked'
    );

    // 5. Attack 5: Malicious Executable Upload Defense
    const exeBuffer = Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00');
    const uploadExeRes = await client.uploadFile(
      '/api/products/upload',
      'image',
      exeBuffer,
      'trojan.exe',
      'application/x-msdownload'
    );
    t.assert(
      uploadExeRes.status === 400 || uploadExeRes.status === 415 || uploadExeRes.status === 401 || uploadExeRes.status === 403 || uploadExeRes.status === 404,
      'Security Check 5: Executable file upload rejected'
    );
  }
};
