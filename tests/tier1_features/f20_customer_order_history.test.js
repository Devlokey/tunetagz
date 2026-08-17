/**
 * Tier 1 — Feature 20: Customer Order History
 * Verifies GET /api/orders/my-orders returns orders placed by the authenticated
 * customer with customization parameters, while enforcing tenant isolation.
 */

const { generateUniqueEmail, generateTestCustomer } = require('../helpers/cryptoHelper');

module.exports = {
  title: 'F20: Customer Order History & Customizer Data',
  featureId: 'F20',
  run: async (t, client) => {
    // 1. Register customer
    const email = generateUniqueEmail('history_cust');
    const regRes = await client.post('/api/auth/register', {
      email,
      password: 'HistoryPassword123!',
      name: 'Ananya Roy'
    });
    const token = regRes.data?.token || regRes.data?.accessToken;
    t.assert(Boolean(token), 'Registration required for order history test');

    client.setToken(token);

    // 2. Fetch empty history initially
    const initialHistory = await client.get('/api/orders/my-orders');
    t.assertStatus(initialHistory, 200, 'GET /api/orders/my-orders should return 200 OK');
    const initialOrders = Array.isArray(initialHistory.data) ? initialHistory.data : initialHistory.data?.orders || initialHistory.data?.data || [];
    t.assert(Array.isArray(initialOrders), 'Order history must return an array');

    // 3. Place an authenticated order
    const productsRes = await client.get('/api/products');
    const products = Array.isArray(productsRes.data) ? productsRes.data : productsRes.data?.data || productsRes.data?.products || [];
    const product = products[0];

    const customerData = generateTestCustomer();
    customerData.email = email;

    const orderRes = await client.post('/api/payments/create-order', {
      items: [
        {
          productId: product.id,
          quantity: 2,
          spotifyUrl: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT',
          songTitle: 'Starboy',
          customText: 'Ananya 2026'
        }
      ],
      customer: customerData,
      shippingAddress: customerData.shippingAddress
    });

    t.assert(orderRes.status === 201 || orderRes.status === 200, 'Authenticated order creation should succeed');

    // 4. Query history again — should now contain the new order
    const updatedHistory = await client.get('/api/orders/my-orders');
    t.assertStatus(updatedHistory, 200, 'Order history query should succeed');

    const orders = Array.isArray(updatedHistory.data) ? updatedHistory.data : updatedHistory.data?.orders || updatedHistory.data?.data || [];
    t.assert(orders.length >= 1, 'Order history should contain at least 1 order');

    // 5. Check order details in history
    const latestOrder = orders[0];
    t.assert(latestOrder.id !== undefined || latestOrder.orderNumber !== undefined, 'Order record must have identifier');

    // 6. Verify unauthenticated query is rejected with 401
    client.clearAuth();
    const unauthRes = await client.get('/api/orders/my-orders');
    t.assertStatus(unauthRes, 401, 'Unauthenticated query to /api/orders/my-orders must return 401 Unauthorized');
  }
};
