/**
 * Tier 3 — Combination 1: Complete Customer Authentication & Order Lifecycle
 * Cross-feature pairwise workflow:
 * Register -> Login -> Configure Custom Tag -> Place Order -> Razorpay Pay -> Verify HMAC -> Verify History & Live Tracking
 */

const { generateUniqueEmail, generateTestCustomer, generateRazorpaySignature, DEFAULT_RAZORPAY_SECRET } = require('../helpers/cryptoHelper');

module.exports = {
  title: 'C1: Customer Auth & Order Lifecycle Integration',
  run: async (t, client) => {
    // Step 1: Customer Registration
    const email = generateUniqueEmail('combo_cust');
    const password = 'ComboPassword123!';
    const name = 'Rohan Gupta';

    const regRes = await client.post('/api/auth/register', { email, password, name, phone: '+919876543210' });
    t.assert(regRes.status === 201 || regRes.status === 200, 'Step 1: Registration succeeded');

    // Step 2: Customer Login & Token acquisition
    const loginRes = await client.post('/api/auth/login', { email, password });
    t.assertStatus(loginRes, 200, 'Step 2: Login succeeded');
    const customerToken = loginRes.data?.token || loginRes.data?.accessToken;
    t.assert(Boolean(customerToken), 'Step 2: Token acquired');
    client.setToken(customerToken);

    // Step 3: Browse public catalog & pick Spotify Code Tag
    const catalogRes = await client.get('/api/products');
    t.assertStatus(catalogRes, 200, 'Step 3: Catalog fetched');
    const products = Array.isArray(catalogRes.data) ? catalogRes.data : catalogRes.data?.data || catalogRes.data?.products || [];
    const product = products[0];

    // Step 4: Place Order with Custom Spotify Link and Engraving Text
    const customerData = generateTestCustomer();
    customerData.email = email;
    customerData.name = name;

    const createOrderRes = await client.post('/api/payments/create-order', {
      items: [
        {
          productId: product.id,
          quantity: 1,
          spotifyUrl: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
          songTitle: 'Starboy',
          artistName: 'The Weeknd',
          customText: 'Rohan 2026'
        }
      ],
      customer: customerData,
      shippingAddress: customerData.shippingAddress
    });
    t.assert(createOrderRes.status === 201 || createOrderRes.status === 200, 'Step 4: Order created');

    const paymentData = createOrderRes.data?.data || createOrderRes.data;
    const internalOrderId = paymentData.orderId || paymentData.id;
    const rzpOrderId = paymentData.razorpayOrderId || paymentData.razorpay_order_id || 'order_mock_' + Date.now();
    const rzpPaymentId = 'pay_combo_' + Date.now().toString(36);

    // Step 5: Cryptographic Payment Verification (HMAC-SHA256)
    const validSignature = generateRazorpaySignature(rzpOrderId, rzpPaymentId, DEFAULT_RAZORPAY_SECRET);

    const verifyRes = await client.post('/api/payments/verify', {
      orderId: internalOrderId,
      razorpay_order_id: rzpOrderId,
      razorpay_payment_id: rzpPaymentId,
      razorpay_signature: validSignature
    });
    t.assertStatus(verifyRes, 200, 'Step 5: Payment verified');

    // Step 6: Verify in Customer Order History
    const historyRes = await client.get('/api/orders/my-orders');
    t.assertStatus(historyRes, 200, 'Step 6: Customer history retrieved');
    const orders = Array.isArray(historyRes.data) ? historyRes.data : historyRes.data?.orders || historyRes.data?.data || [];
    t.assert(orders.length >= 1, 'Step 6: Order present in customer history');

    // Step 7: Verify in Public Live Tracking
    client.clearAuth();
    let trackRes = await client.get(`/api/orders/${internalOrderId}/track`);
    if (trackRes.status === 404) {
      trackRes = await client.get(`/api/orders/track?orderNumber=${internalOrderId}&email=${email}`);
    }
    t.assertStatus(trackRes, 200, 'Step 7: Live tracking verified');
    const trackData = trackRes.data?.order || trackRes.data?.data || trackRes.data;
    const status = (trackData.status || '').toUpperCase();
    t.assert(
      status === 'ORDER_RECEIVED' || status === 'RECEIVED' || status === 'PAID',
      'Step 7: Order status confirmed as ORDER_RECEIVED'
    );
  }
};
