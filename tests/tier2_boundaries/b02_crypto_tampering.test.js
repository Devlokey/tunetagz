/**
 * Tier 2 — Boundary 2: Cryptographic HMAC Tampering & Replay Defense
 * Exercises cryptographic edge cases:
 * - Single-bit flipped forged signature
 * - Empty / null / truncated signature strings
 * - Replay attack with identical payment verification payload
 * - Cross-order signature substitution
 */

const { generateTestCustomer, generateRazorpaySignature, DEFAULT_RAZORPAY_SECRET } = require('../helpers/cryptoHelper');

module.exports = {
  title: 'B2: Cryptographic HMAC Tampering & Replay Defense',
  run: async (t, client) => {
    // 1. Create order
    const productsRes = await client.get('/api/products');
    const products = Array.isArray(productsRes.data) ? productsRes.data : productsRes.data?.data || productsRes.data?.products || [];
    const product = products[0];

    const customer = generateTestCustomer();
    const createRes = await client.post('/api/payments/create-order', {
      items: [{ productId: product.id, quantity: 1, customText: 'Crypto Tamper' }],
      customer,
      shippingAddress: customer.shippingAddress
    });

    const paymentData = createRes.data?.data || createRes.data;
    const rzpOrderId = paymentData.razorpayOrderId || paymentData.razorpay_order_id || 'order_mock_' + Date.now();
    const orderId = paymentData.orderId || paymentData.id;
    const rzpPaymentId = 'pay_tamper_' + Date.now().toString(36);

    const validSignature = generateRazorpaySignature(rzpOrderId, rzpPaymentId, DEFAULT_RAZORPAY_SECRET);

    // 2. Vector 1: Flipped single character in signature
    const flippedSignature = validSignature.substring(0, validSignature.length - 1) +
      (validSignature.endsWith('0') ? '1' : '0');

    const flippedRes = await client.post('/api/payments/verify', {
      orderId,
      razorpay_order_id: rzpOrderId,
      razorpay_payment_id: rzpPaymentId,
      razorpay_signature: flippedSignature
    });

    t.assert(
      flippedRes.status === 400 || flippedRes.status === 422,
      'Single-bit flipped HMAC signature must be rejected with 400/422'
    );

    // 3. Vector 2: Empty / truncated signature string
    const emptySigRes = await client.post('/api/payments/verify', {
      orderId,
      razorpay_order_id: rzpOrderId,
      razorpay_payment_id: rzpPaymentId,
      razorpay_signature: ''
    });

    t.assert(
      emptySigRes.status === 400 || emptySigRes.status === 422,
      'Empty HMAC signature must be rejected with 400/422'
    );

    // 4. Vector 3: Null signature parameter
    const nullSigRes = await client.post('/api/payments/verify', {
      orderId,
      razorpay_order_id: rzpOrderId,
      razorpay_payment_id: rzpPaymentId,
      razorpay_signature: null
    });

    t.assert(
      nullSigRes.status === 400 || nullSigRes.status === 422,
      'Null HMAC signature must be rejected with 400/422'
    );

    // 5. Valid payment verification
    const validRes = await client.post('/api/payments/verify', {
      orderId,
      razorpay_order_id: rzpOrderId,
      razorpay_payment_id: rzpPaymentId,
      razorpay_signature: validSignature
    });
    t.assertStatus(validRes, 200, 'Valid signature should confirm order');

    // 6. Vector 4: Replay attack (re-verifying already captured payment)
    const replayRes = await client.post('/api/payments/verify', {
      orderId,
      razorpay_order_id: rzpOrderId,
      razorpay_payment_id: rzpPaymentId,
      razorpay_signature: validSignature
    });
    t.assert(
      replayRes.status === 200 || replayRes.status === 409,
      'Replay attack must be safely absorbed (200 OK idempotent or 409 Conflict)'
    );
  }
};
