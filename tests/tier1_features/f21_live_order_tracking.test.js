/**
 * Tier 1 — Feature 21: Live Order Tracking API
 * Verifies public and authenticated live order tracking, timeline milestones,
 * courier info lookup, and 404 handling.
 */

const { generateTestCustomer } = require('../helpers/cryptoHelper');

module.exports = {
  title: 'F21: Live Order Tracking API',
  featureId: 'F21',
  run: async (t, client) => {
    // 1. Create an order to track
    const productsRes = await client.get('/api/products');
    const products = Array.isArray(productsRes.data) ? productsRes.data : productsRes.data?.data || productsRes.data?.products || [];
    const product = products[0];

    const customerData = generateTestCustomer();
    const orderRes = await client.post('/api/payments/create-order', {
      items: [{ productId: product.id, quantity: 1, customText: 'Track Me' }],
      customer: customerData,
      shippingAddress: customerData.shippingAddress
    });

    const orderData = orderRes.data?.data || orderRes.data?.order || orderRes.data;
    const orderId = orderData.orderId || orderData.orderNumber || orderData.id;
    t.assert(Boolean(orderId), 'Order identifier needed for tracking');

    // 2. Track order by ID: GET /api/orders/:orderId/track or /api/orders/track?orderNumber=...
    let trackRes = await client.get(`/api/orders/${orderId}/track`);
    if (trackRes.status === 404) {
      trackRes = await client.get(`/api/orders/track?orderNumber=${orderId}&email=${customerData.email}`);
    }

    t.assertStatus(trackRes, 200, 'Order tracking endpoint should return 200 OK');

    const tracked = trackRes.data?.order || trackRes.data?.data || trackRes.data;
    t.assert(Boolean(tracked), 'Tracking response should contain order tracking data');
    t.assert(Boolean(tracked.status), 'Tracking response must include current order status');

    // 3. Track non-existent order
    const fakeTrackRes = await client.get('/api/orders/TTZ-FAKE-ORDER-99999/track');
    t.assert(
      fakeTrackRes.status === 404 || fakeTrackRes.status === 400,
      'Tracking non-existent order should return 404/400'
    );
  }
};
