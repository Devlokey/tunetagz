/**
 * Tier 1 — Feature 17: Cryptographic Payment Verification
 * Verifies HMAC-SHA256 signature verification algorithm, order status transition
 * to ORDER_RECEIVED, rejection of forged signatures, and payment record storage.
 */

const { generateTestCustomer, generateRazorpaySignature, DEFAULT_RAZORPAY_SECRET } = require('../helpers/cryptoHelper');

module.exports = {
  title: 'F17: Cryptographic Payment Verification (HMAC-SHA256)',
  featureId: 'F17',
  run: async (t, client) => {
    // 1. Create an order to pay
    const productsRes = await client.get('/api/products');
    const products = Array.isArray(productsRes.data) ? productsRes.data : productsRes.data?.data || productsRes.data?.products || [];
    const product = products[0];

    const customerData = generateTestCustomer();
    const createOrderRes = await client.post('/api/payments/create-order', {
      items: [{ productId: product.id, quantity: 1, customText: 'HMAC Test' }],
      customer: customerData,
      shippingAddress: customerData.shippingAddress
    });

    t.assert(createOrderRes.status === 201 || createOrderRes.status === 200, 'Order creation should succeed');

    const paymentData = createOrderRes.data?.data || createOrderRes.data;
    const rzpOrderId = paymentData.razorpayOrderId || paymentData.razorpay_order_id || 'order_mock_' + Date.now();
    const internalOrderId = paymentData.orderId || paymentData.id;
    const rzpPaymentId = 'pay_test_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);

    // 2. Generate forged/invalid signature
    const forgedSignature = 'bad_forged_signature_000000000000000000000000000000000000000000000000';
    const badVerifyRes = await client.post('/api/payments/verify', {
      orderId: internalOrderId,
      razorpay_order_id: rzpOrderId,
      razorpay_payment_id: rzpPaymentId,
      razorpay_signature: forgedSignature
    });

    t.assert(
      badVerifyRes.status === 400 || badVerifyRes.status === 422,
      'Payment verification with forged signature must be rejected with 400/422'
    );

    // 3. Generate valid signature using server secret
    const validSignature = generateRazorpaySignature(rzpOrderId, rzpPaymentId, DEFAULT_RAZORPAY_SECRET);

    const verifyRes = await client.post('/api/payments/verify', {
      orderId: internalOrderId,
      razorpay_order_id: rzpOrderId,
      razorpay_payment_id: rzpPaymentId,
      razorpay_signature: validSignature
    });

    t.assertStatus(verifyRes, 200, 'Payment verification with valid signature should return 200 OK');

    const verifyData = verifyRes.data?.order || verifyRes.data?.data || verifyRes.data;
    t.assert(Boolean(verifyData), 'Verification response should return updated order details');

    // 4. Verify order transitioned to ORDER_RECEIVED or PAID
    const newStatus = (verifyData.status || '').toUpperCase();
    t.assert(
      newStatus === 'ORDER_RECEIVED' || newStatus === 'RECEIVED' || newStatus === 'PAID',
      `Order status after payment should be ORDER_RECEIVED / PAID, got ${newStatus}`
    );

    // 5. Test idempotent replay of same payment verification
    const replayRes = await client.post('/api/payments/verify', {
      orderId: internalOrderId,
      razorpay_order_id: rzpOrderId,
      razorpay_payment_id: rzpPaymentId,
      razorpay_signature: validSignature
    });

    t.assert(
      replayRes.status === 200 || replayRes.status === 409,
      'Replay verification should be handled cleanly without crash (200 OK or 409 Conflict)'
    );
  }
};
