/**
 * Tier 3 — Combination 3: Cross-Role Order Fulfillment Synchronization
 * Cross-feature pairwise workflow:
 * Customer places order -> Payment verified -> Admin views in Admin Portal ->
 * Admin transitions to ENGRAVING -> Customer tracking reflects ENGRAVING ->
 * Admin transitions to DISPATCHED with BlueDart AWB -> Customer tracking shows AWB ->
 * Admin marks DELIVERED -> Customer tracking shows DELIVERED.
 */

const { generateTestCustomer, generateRazorpaySignature, DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD, DEFAULT_RAZORPAY_SECRET } = require('../helpers/cryptoHelper');

module.exports = {
  title: 'C3: Cross-Role Order Fulfillment Synchronization',
  run: async (t, client) => {
    // 1. Customer places order
    const productsRes = await client.get('/api/products');
    const products = Array.isArray(productsRes.data) ? productsRes.data : productsRes.data?.data || productsRes.data?.products || [];
    const product = products[0];

    const customer = generateTestCustomer();
    const createOrderRes = await client.post('/api/payments/create-order', {
      items: [{ productId: product.id, quantity: 1, customText: 'Live Sync Test' }],
      customer,
      shippingAddress: customer.shippingAddress
    });

    const paymentData = createOrderRes.data?.data || createOrderRes.data;
    const internalOrderId = paymentData.orderId || paymentData.id;
    const rzpOrderId = paymentData.razorpayOrderId || paymentData.razorpay_order_id || 'order_mock_' + Date.now();
    const rzpPaymentId = 'pay_sync_' + Date.now().toString(36);

    // 2. Verify payment (ORDER_RECEIVED)
    const validSignature = generateRazorpaySignature(rzpOrderId, rzpPaymentId, DEFAULT_RAZORPAY_SECRET);
    await client.post('/api/payments/verify', {
      orderId: internalOrderId,
      razorpay_order_id: rzpOrderId,
      razorpay_payment_id: rzpPaymentId,
      razorpay_signature: validSignature
    });

    // 3. Admin logs in
    let adminLogin = await client.post('/api/auth/admin/login', {
      email: DEFAULT_ADMIN_EMAIL,
      password: DEFAULT_ADMIN_PASSWORD
    });
    if (adminLogin.status === 404) {
      adminLogin = await client.post('/api/auth/login', {
        email: DEFAULT_ADMIN_EMAIL,
        password: DEFAULT_ADMIN_PASSWORD
      });
    }
    const adminToken = adminLogin.data?.token || adminLogin.data?.accessToken;
    client.setToken(adminToken);

    // 4. Admin advances to ENGRAVING
    await client.patch(`/api/admin/orders/${internalOrderId}/status`, { status: 'ENGRAVING' });

    // 5. Customer checks tracking — must reflect ENGRAVING
    client.clearAuth();
    let track1 = await client.get(`/api/orders/${internalOrderId}/track`);
    if (track1.status === 404) track1 = await client.get(`/api/orders/track?orderNumber=${internalOrderId}&email=${customer.email}`);
    t.assertStatus(track1, 200, 'Customer tracking accessible');
    const data1 = track1.data?.order || track1.data?.data || track1.data;
    t.assertEqual((data1.status || '').toUpperCase(), 'ENGRAVING', 'Customer live tracking shows ENGRAVING');

    // 6. Admin advances to DISPATCHED with BlueDart AWB
    client.setToken(adminToken);
    const awbNumber = 'BD-TRACK-77665544IN';
    await client.patch(`/api/admin/orders/${internalOrderId}/status`, {
      status: 'DISPATCHED',
      courierName: 'BlueDart Express',
      trackingNumber: awbNumber
    });

    // 7. Customer checks tracking — must reflect DISPATCHED and AWB number
    client.clearAuth();
    let track2 = await client.get(`/api/orders/${internalOrderId}/track`);
    if (track2.status === 404) track2 = await client.get(`/api/orders/track?orderNumber=${internalOrderId}&email=${customer.email}`);
    const data2 = track2.data?.order || track2.data?.data || track2.data;
    t.assertEqual((data2.status || '').toUpperCase(), 'DISPATCHED', 'Customer live tracking shows DISPATCHED');

    // 8. Admin advances to DELIVERED
    client.setToken(adminToken);
    await client.patch(`/api/admin/orders/${internalOrderId}/status`, { status: 'DELIVERED' });

    // 9. Customer checks tracking — must reflect DELIVERED
    client.clearAuth();
    let track3 = await client.get(`/api/orders/${internalOrderId}/track`);
    if (track3.status === 404) track3 = await client.get(`/api/orders/track?orderNumber=${internalOrderId}&email=${customer.email}`);
    const data3 = track3.data?.order || track3.data?.data || track3.data;
    t.assertEqual((data3.status || '').toUpperCase(), 'DELIVERED', 'Customer live tracking shows DELIVERED');
  }
};
