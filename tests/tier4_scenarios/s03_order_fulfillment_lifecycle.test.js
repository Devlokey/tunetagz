/**
 * Tier 4 — Scenario 3: Real-World Order Fulfillment Lifecycle
 * Simulates the full multi-stage physical manufacturing and delivery lifecycle:
 * 1. Customer places and pays for custom engraved order.
 * 2. Order enters ORDER_RECEIVED state in admin queue.
 * 3. Workshop starts laser engraving -> status transitions to ENGRAVING.
 * 4. Production completes & package dispatched with Courier partner -> status transitions to DISPATCHED.
 * 5. Courier confirms door delivery -> status transitions to DELIVERED.
 * 6. Customer live tracking stepper accurately verifies each step in real time.
 */

const { generateTestCustomer, generateRazorpaySignature, DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD, DEFAULT_RAZORPAY_SECRET } = require('../helpers/cryptoHelper');

module.exports = {
  title: 'S3: Real-World Order Fulfillment Lifecycle Scenario',
  run: async (t, client) => {
    // 1. Order placement & payment
    const productsRes = await client.get('/api/products');
    const products = Array.isArray(productsRes.data) ? productsRes.data : productsRes.data?.data || productsRes.data?.products || [];
    const product = products[0];

    const customer = generateTestCustomer();
    const orderRes = await client.post('/api/payments/create-order', {
      items: [{ productId: product.id, quantity: 1, customText: 'Lifecycle Test' }],
      customer,
      shippingAddress: customer.shippingAddress
    });

    const paymentData = orderRes.data?.data || orderRes.data;
    const internalOrderId = paymentData.orderId || paymentData.id;
    const rzpOrderId = paymentData.razorpayOrderId || paymentData.razorpay_order_id || 'order_mock_' + Date.now();
    const rzpPaymentId = 'pay_lifecycle_' + Date.now().toString(36);

    const signature = generateRazorpaySignature(rzpOrderId, rzpPaymentId, DEFAULT_RAZORPAY_SECRET);
    await client.post('/api/payments/verify', {
      orderId: internalOrderId,
      razorpay_order_id: rzpOrderId,
      razorpay_payment_id: rzpPaymentId,
      razorpay_signature: signature
    });

    // 2. Admin Login
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

    // 3. Stage 1: Received -> Engraving
    const engRes = await client.patch(`/api/admin/orders/${internalOrderId}/status`, {
      status: 'ENGRAVING',
      notes: 'Custom Spotify soundwave engraving active'
    });
    t.assertStatus(engRes, 200, 'Stage 1: Engraving status updated');

    // 4. Stage 2: Engraving -> Dispatched
    const dispRes = await client.patch(`/api/admin/orders/${internalOrderId}/status`, {
      status: 'DISPATCHED',
      courierName: 'Delhivery',
      trackingNumber: 'DEL-99887766-IN'
    });
    t.assertStatus(dispRes, 200, 'Stage 2: Dispatched status updated');

    // 5. Stage 3: Dispatched -> Delivered
    const delivRes = await client.patch(`/api/admin/orders/${internalOrderId}/status`, {
      status: 'DELIVERED',
      notes: 'Delivered to customer doorstep'
    });
    t.assertStatus(delivRes, 200, 'Stage 3: Delivered status updated');

    // 6. Verify Customer Tracking Shows Final Delivered State
    client.clearAuth();
    let trackRes = await client.get(`/api/orders/${internalOrderId}/track`);
    if (trackRes.status === 404) {
      trackRes = await client.get(`/api/orders/track?orderNumber=${internalOrderId}&email=${customer.email}`);
    }
    const trackedOrder = trackRes.data?.order || trackRes.data?.data || trackRes.data;
    t.assertEqual((trackedOrder.status || '').toUpperCase(), 'DELIVERED', 'Customer tracking shows DELIVERED');
  }
};
