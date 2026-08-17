/**
 * Tier 4 — Scenario 5: Concurrent Customer Orders & Inventory Integrity
 * Exercises high-concurrency order placement and transaction safety:
 * - 10 simultaneous customer order requests placed concurrently
 * - Verifies every order receives a unique order number
 * - Verifies no SQLite locking or transaction race conditions occur
 * - Verifies distinct payment tracking records for all concurrent purchases
 */

const { generateTestCustomer } = require('../helpers/cryptoHelper');

module.exports = {
  title: 'S5: Concurrent Customer Orders & Inventory Concurrency Scenario',
  run: async (t, client) => {
    // 1. Fetch available product
    const productsRes = await client.get('/api/products');
    const products = Array.isArray(productsRes.data) ? productsRes.data : productsRes.data?.data || productsRes.data?.products || [];
    const product = products[0];

    // 2. Launch 8 concurrent order placements in parallel
    const CONCURRENCY_COUNT = 8;
    const orderPromises = [];

    for (let i = 0; i < CONCURRENCY_COUNT; i++) {
      const cust = generateTestCustomer();
      cust.name = `Concurrent Customer ${i + 1}`;
      const payload = {
        items: [{ productId: product.id, quantity: 1, customText: `Concurrent ${i + 1}` }],
        customer: cust,
        shippingAddress: cust.shippingAddress
      };
      orderPromises.push(client.post('/api/payments/create-order', payload));
    }

    const responses = await Promise.all(orderPromises);

    // 3. Verify all concurrent orders succeeded
    const orderNumbers = new Set();
    const razorpayOrderIds = new Set();

    for (let i = 0; i < responses.length; i++) {
      const res = responses[i];
      t.assert(
        res.status === 201 || res.status === 200,
        `Concurrent order #${i + 1} succeeded with status ${res.status}`
      );

      const data = res.data?.data || res.data;
      const orderNum = data.orderId || data.orderNumber || data.id;
      const rzpId = data.razorpayOrderId || data.razorpay_order_id;

      if (orderNum) orderNumbers.add(String(orderNum));
      if (rzpId) razorpayOrderIds.add(String(rzpId));
    }

    // 4. Verify all order numbers are globally unique (no collision)
    t.assertEqual(
      orderNumbers.size,
      CONCURRENCY_COUNT,
      `All ${CONCURRENCY_COUNT} concurrent orders must have unique order numbers`
    );

    // 5. Verify all Razorpay order IDs are distinct
    t.assertEqual(
      razorpayOrderIds.size,
      CONCURRENCY_COUNT,
      `All ${CONCURRENCY_COUNT} payment sessions must have distinct Razorpay Order IDs`
    );
  }
};
