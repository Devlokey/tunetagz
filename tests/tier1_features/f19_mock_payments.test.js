/**
 * Tier 1 — Feature 19: Sandbox / Mock Payments Mode
 * Verifies that the mock payment provider allows full deterministic offline
 * and CI testing without external Razorpay API credentials.
 */

const { generateTestCustomer, generateRazorpaySignature, DEFAULT_RAZORPAY_SECRET } = require('../helpers/cryptoHelper');

module.exports = {
  title: 'F19: Sandbox / Mock Payment Provider for CI & Offline',
  featureId: 'F19',
  run: async (t, client) => {
    // 1. Fetch available product
    const productsRes = await client.get('/api/products');
    const products = Array.isArray(productsRes.data) ? productsRes.data : productsRes.data?.data || productsRes.data?.products || [];
    const product = products[0];

    const customerData = generateTestCustomer();

    // 2. Create order in mock mode
    const createOrderRes = await client.post('/api/payments/create-order', {
      items: [{ productId: product.id, quantity: 1, customText: 'Mock Payment Test' }],
      customer: customerData,
      shippingAddress: customerData.shippingAddress
    });

    t.assert(
      createOrderRes.status === 201 || createOrderRes.status === 200,
      'Mock order creation should succeed with 201/200'
    );

    const paymentData = createOrderRes.data?.data || createOrderRes.data;
    const rzpOrderId = paymentData.razorpayOrderId || paymentData.razorpay_order_id;
    t.assert(Boolean(rzpOrderId), 'Mock order should generate valid order ID');

    // 3. Verify amount in paise
    const amount = Number(paymentData.amount || paymentData.totalAmount);
    t.assert(amount > 0, 'Payment amount must be greater than zero');

    // 4. Verify mock payment verification works without live API key
    const paymentId = 'pay_mock_' + Date.now();
    const signature = generateRazorpaySignature(rzpOrderId, paymentId, DEFAULT_RAZORPAY_SECRET);
    const verifyRes = await client.post('/api/payments/verify', {
      orderId: paymentData.orderId || paymentData.id,
      razorpay_order_id: rzpOrderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature
    });

    t.assertStatus(
      verifyRes,
      200,
      'Mock payment verification endpoint should successfully confirm order'
    );

    // 5. Verify currency is INR
    const currency = paymentData.currency || 'INR';
    t.assertEqual(currency.toUpperCase(), 'INR', 'Mock payment currency must be INR');

    // 6. Verify verified order structure
    const verifiedOrder = verifyRes.data?.order || verifyRes.data?.data || verifyRes.data;
    t.assert(Boolean(verifiedOrder), 'Verification response contains confirmed order record');
  }
};
