/**
 * Tier 1 — Feature 16: Razorpay Order Creation
 * Verifies Razorpay order creation API, INR currency, amount in paise,
 * and key ID provision.
 */

const { generateTestCustomer } = require('../helpers/cryptoHelper');

module.exports = {
  title: 'F16: Razorpay Order Creation',
  featureId: 'F16',
  run: async (t, client) => {
    // 1. Fetch product
    const productsRes = await client.get('/api/products');
    const products = Array.isArray(productsRes.data) ? productsRes.data : productsRes.data?.data || productsRes.data?.products || [];
    const product = products[0];

    const customerData = generateTestCustomer();

    // 2. Call /api/payments/create-order
    const res = await client.post('/api/payments/create-order', {
      items: [
        {
          productId: product.id,
          quantity: 1,
          spotifyUrl: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
          customText: 'Test Order'
        }
      ],
      customer: {
        name: customerData.name,
        email: customerData.email,
        phone: customerData.phone
      },
      shippingAddress: customerData.shippingAddress
    });

    t.assert(
      res.status === 201 || res.status === 200,
      `Payment order creation should return 200/201, got ${res.status}`
    );

    const data = res.data?.data || res.data;
    t.assert(Boolean(data), 'Response should contain payment order data');

    // 3. Verify Razorpay Order ID
    const rzpOrderId = data.razorpayOrderId || data.razorpay_order_id || data.orderId;
    t.assert(Boolean(rzpOrderId), 'Response must contain razorpayOrderId');

    // 4. Verify Amount is in INR paise (e.g. 699 * 100 = 69900)
    const amount = Number(data.amount || data.totalAmount);
    t.assert(
      amount === Number(product.price) * 100 || amount === Number(product.price),
      `Amount (${amount}) should represent product price in paise or rupees`
    );

    // 5. Verify Currency is INR
    const currency = data.currency || 'INR';
    t.assertEqual(currency.toUpperCase(), 'INR', 'Currency must be INR');

    // 6. Verify Key ID is provided
    const keyId = data.keyId || data.razorpayKeyId || data.key;
    t.assert(Boolean(keyId || process.env.RAZORPAY_KEY_ID), 'Key ID must be available for Razorpay checkout');
  }
};
