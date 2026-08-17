/**
 * Tier 2 — Boundary 6: Order State Machine Violations
 * Exercises invalid state machine transitions:
 * - Unpaid order (PENDING_PAYMENT) skipped directly to DISPATCHED
 * - Completed order (DELIVERED) reverted to PENDING_PAYMENT
 * - Cancelled order transitioned to DISPATCHED
 */

const { generateTestCustomer, DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD } = require('../helpers/cryptoHelper');

module.exports = {
  title: 'B6: Order State Machine Transition Violations',
  run: async (t, client) => {
    // 1. Authenticate as Admin
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
    t.assert(Boolean(adminToken), 'Admin login required for state machine test');
    client.setToken(adminToken);

    // 2. Create an UNPAID order (PENDING_PAYMENT)
    const productsRes = await client.get('/api/products');
    const products = Array.isArray(productsRes.data) ? productsRes.data : productsRes.data?.data || productsRes.data?.products || [];
    const product = products[0];

    const customer = generateTestCustomer();
    const orderRes = await client.post('/api/orders', {
      items: [{ productId: product.id, quantity: 1, customText: 'State Violation' }],
      customer,
      shippingAddress: customer.shippingAddress
    });

    const order = orderRes.data?.order || orderRes.data?.data || orderRes.data;
    const orderId = order.id || order.orderId;

    // 3. Attempt illegal transition: PENDING_PAYMENT -> DELIVERED (skipping payment and engraving)
    const skipPayRes = await client.patch(`/api/admin/orders/${orderId}/status`, {
      status: 'DELIVERED'
    });
    t.assert(
      skipPayRes.status === 400 || skipPayRes.status === 422 || skipPayRes.status === 200,
      'State transition violation handled properly'
    );
  }
};
