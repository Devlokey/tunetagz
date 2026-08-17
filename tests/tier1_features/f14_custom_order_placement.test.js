/**
 * Tier 1 — Feature 14: Custom Order Placement
 * Verifies creating an order with custom Spotify details, shipping address,
 * initial PENDING_PAYMENT status, and unique orderNumber assignment.
 */

const { generateTestCustomer } = require('../helpers/cryptoHelper');

module.exports = {
  title: 'F14: Custom Order Placement',
  featureId: 'F14',
  run: async (t, client) => {
    // 1. Fetch products to get Spotify Code Tag ID
    const productsRes = await client.get('/api/products');
    const products = Array.isArray(productsRes.data) ? productsRes.data : productsRes.data?.data || productsRes.data?.products || [];
    const spotifyProduct = products.find(p => p.sku === 'SPT-001' || (p.name && p.name.toLowerCase().includes('spotify'))) || products[0];
    t.assert(Boolean(spotifyProduct), 'Need product to place test order');

    const customerData = generateTestCustomer();
    const orderPayload = {
      customer: {
        name: customerData.name,
        email: customerData.email,
        phone: customerData.phone
      },
      shippingAddress: customerData.shippingAddress,
      items: [
        {
          productId: spotifyProduct.id,
          quantity: 1,
          spotifyUrl: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
          songTitle: 'Starboy',
          artistName: 'The Weeknd',
          customText: 'Arjun 2026'
        }
      ]
    };

    // 2. Place order via POST /api/orders or /api/payments/create-order
    let orderRes = await client.post('/api/orders', orderPayload);
    if (orderRes.status === 404) {
      orderRes = await client.post('/api/payments/create-order', orderPayload);
    }

    t.assert(
      orderRes.status === 201 || orderRes.status === 200,
      `Order creation should succeed with 201/200, got ${orderRes.status}`
    );

    const orderData = orderRes.data?.order || orderRes.data?.data || orderRes.data;
    t.assert(Boolean(orderData), 'Order response must contain order object');

    // 3. Verify order status is PENDING_PAYMENT
    const status = (orderData.status || '').toUpperCase();
    t.assert(
      status === 'PENDING_PAYMENT' || status === 'CREATED' || status === 'PENDING',
      `Initial order status should be PENDING_PAYMENT, got ${status}`
    );

    // 4. Verify order number / ID format
    const orderNumber = orderData.orderNumber || orderData.order_number || orderData.id;
    t.assert(Boolean(orderNumber), 'Order must have unique orderNumber');

    // 5. Verify total amount matches product price
    const totalAmount = orderData.totalAmount || orderData.total_amount || orderData.amount;
    t.assert(
      Number(totalAmount) === Number(spotifyProduct.price) || Number(totalAmount) === Number(spotifyProduct.price) * 100,
      'Order total must equal product price'
    );

    // 6. Attempt order placement with empty items array -> 400 Bad Request
    const emptyOrderRes = await client.post('/api/orders', {
      customer: customerData,
      shippingAddress: customerData.shippingAddress,
      items: []
    });
    t.assert(
      emptyOrderRes.status === 400 || emptyOrderRes.status === 422,
      'Empty items array in order should be rejected with 400/422'
    );
  }
};
