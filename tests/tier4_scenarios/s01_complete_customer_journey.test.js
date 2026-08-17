/**
 * Tier 4 — Scenario 1: Complete Real-World Customer E2E Journey
 * Simulates a realistic customer end-to-end purchasing journey:
 * 1. Visitor loads storefront landing page (index.html).
 * 2. Visitor registers new customer account with credentials.
 * 3. Customer browses dynamic catalog and selects Spotify Code Tag (SPT-001).
 * 4. Customer configures Spotify soundwave code + 2-sided custom engraving text.
 * 5. Customer enters delivery address and initiates checkout.
 * 6. Server generates Razorpay order with strict DB price calculation.
 * 7. Customer completes payment via Razorpay payment modal.
 * 8. Server verifies cryptographic HMAC signature and transitions order to ORDER_RECEIVED.
 * 9. Customer views confirmation in personal order dashboard (my-orders).
 * 10. Customer tracks live order milestone stepper.
 */

const { generateUniqueEmail, generateTestCustomer, generateRazorpaySignature, DEFAULT_RAZORPAY_SECRET } = require('../helpers/cryptoHelper');

module.exports = {
  title: 'S1: Complete Real-World Customer E2E Journey',
  run: async (t, client) => {
    // 1. Visit Storefront
    const landing = await client.get('/');
    t.assertStatus(landing, 200, 'Phase 1: Storefront loaded successfully');

    // 2. Customer Registration
    const email = generateUniqueEmail('journey_cust');
    const password = 'JourneySecretPassword2026!';
    const name = 'Devika Sen';

    const reg = await client.post('/api/auth/register', { email, password, name, phone: '+919876543210' });
    t.assert(reg.status === 201 || reg.status === 200, 'Phase 2: Customer account created');
    const token = reg.data?.token || reg.data?.accessToken;
    client.setToken(token);

    // 3. Browse Catalog
    const catalog = await client.get('/api/products');
    t.assertStatus(catalog, 200, 'Phase 3: Product catalog fetched');
    const products = Array.isArray(catalog.data) ? catalog.data : catalog.data?.data || catalog.data?.products || [];
    const spotifyProduct = products.find(p => p.sku === 'SPT-001') || products[0];

    // 4 & 5. Configure & Place Order
    const customerInfo = generateTestCustomer();
    customerInfo.email = email;
    customerInfo.name = name;

    const orderPayload = {
      customer: customerInfo,
      shippingAddress: customerInfo.shippingAddress,
      items: [
        {
          productId: spotifyProduct.id,
          quantity: 1,
          spotifyUrl: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
          songTitle: 'Starboy',
          artistName: 'The Weeknd',
          customText: 'Devika & Kabir 2026'
        }
      ]
    };

    const orderRes = await client.post('/api/payments/create-order', orderPayload);
    t.assert(orderRes.status === 201 || orderRes.status === 200, 'Phase 5: Checkout order created');

    const paymentData = orderRes.data?.data || orderRes.data;
    const internalOrderId = paymentData.orderId || paymentData.id;
    const rzpOrderId = paymentData.razorpayOrderId || paymentData.razorpay_order_id || 'order_mock_' + Date.now();
    const rzpPaymentId = 'pay_journey_' + Date.now().toString(36);

    // 6, 7 & 8. Cryptographic Signature Verification
    const signature = generateRazorpaySignature(rzpOrderId, rzpPaymentId, DEFAULT_RAZORPAY_SECRET);

    const verifyRes = await client.post('/api/payments/verify', {
      orderId: internalOrderId,
      razorpay_order_id: rzpOrderId,
      razorpay_payment_id: rzpPaymentId,
      razorpay_signature: signature
    });
    t.assertStatus(verifyRes, 200, 'Phase 8: Payment verified and confirmed');

    // 9. Customer Order History Introspection
    const historyRes = await client.get('/api/orders/my-orders');
    t.assertStatus(historyRes, 200, 'Phase 9: Order history accessible');
    const orders = Array.isArray(historyRes.data) ? historyRes.data : historyRes.data?.orders || historyRes.data?.data || [];
    t.assert(orders.length >= 1, 'Phase 9: Confirmed order appears in customer portal');

    // 10. Live Tracking Inspection
    client.clearAuth();
    let trackRes = await client.get(`/api/orders/${internalOrderId}/track`);
    if (trackRes.status === 404) {
      trackRes = await client.get(`/api/orders/track?orderNumber=${internalOrderId}&email=${email}`);
    }
    t.assertStatus(trackRes, 200, 'Phase 10: Live order tracking operational');
  }
};
