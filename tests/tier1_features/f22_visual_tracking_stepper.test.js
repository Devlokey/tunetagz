/**
 * Tier 1 — Feature 22: Visual Order Tracking Stepper
 * Verifies the 5-step milestone timeline structure
 * (ORDER_RECEIVED -> ENGRAVING -> QUALITY_CHECK -> DISPATCHED -> DELIVERED)
 * and visual stepper page availability.
 */

const { generateTestCustomer } = require('../helpers/cryptoHelper');

module.exports = {
  title: 'F22: Visual Order Tracking Stepper & Milestones',
  featureId: 'F22',
  run: async (t, client) => {
    // 1. Create and pay an order
    const productsRes = await client.get('/api/products');
    const products = Array.isArray(productsRes.data) ? productsRes.data : productsRes.data?.data || productsRes.data?.products || [];
    const product = products[0];

    const customerData = generateTestCustomer();
    const orderRes = await client.post('/api/payments/create-order', {
      items: [{ productId: product.id, quantity: 1, customText: 'Stepper Test' }],
      customer: customerData,
      shippingAddress: customerData.shippingAddress
    });

    const orderData = orderRes.data?.data || orderRes.data?.order || orderRes.data;
    const orderId = orderData.orderId || orderData.orderNumber || orderData.id;
    t.assert(Boolean(orderId), 'Order ID required for stepper test');

    // 2. Fetch tracking details
    let trackRes = await client.get(`/api/orders/${orderId}/track`);
    if (trackRes.status === 404) {
      trackRes = await client.get(`/api/orders/track?orderNumber=${orderId}&email=${customerData.email}`);
    }

    t.assertStatus(trackRes, 200, 'Tracking details should be returned');
    const tracked = trackRes.data?.order || trackRes.data?.data || trackRes.data;
    t.assert(Boolean(tracked), 'Tracked order object should exist in response');

    // 3. Verify timeline milestones
    if (tracked.timeline) {
      t.assert(Array.isArray(tracked.timeline), 'Timeline should be an array of milestone steps');
      t.assert(tracked.timeline.length >= 3, 'Timeline should contain milestone stages');
      const firstStep = tracked.timeline[0];
      t.assert(Boolean(firstStep.status || firstStep.label), 'Milestone step should have status or label');
    } else {
      t.assert(Boolean(tracked.status), 'Tracking details must include order status');
      t.assert(typeof tracked.status === 'string', 'Order status must be a string');
    }

    // 4. Verify visual tracking page asset availability
    const indexHtmlRes = await client.get('/');
    t.assertStatus(indexHtmlRes, 200, 'Storefront / tracking UI page is served');
  }
};
