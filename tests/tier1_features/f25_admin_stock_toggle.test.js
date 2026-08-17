/**
 * Tier 1 — Feature 25: Admin Stock Availability Toggle
 * Verifies admin inventory control: toggling stock availability (inStock: false/true),
 * storefront sync, and preventing customer orders for out-of-stock items.
 */

const { generateTestCustomer, generateUniqueSku, DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD } = require('../helpers/cryptoHelper');

module.exports = {
  title: 'F25: Admin Stock Availability Toggle',
  featureId: 'F25',
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
    t.assert(Boolean(adminToken), 'Admin login required for stock toggle test');
    client.setToken(adminToken);

    // 2. Create a test product
    const sku = generateUniqueSku('STOCK-TEST');
    let createRes = await client.post('/api/admin/products', {
      sku,
      name: 'Stock Toggle Tag',
      description: 'Test stock toggle',
      price: 500,
      image_url: 'POSTER 1.png',
      is_customizable: 1,
      in_stock: 1
    });

    if (createRes.status === 404) {
      createRes = await client.post('/api/products', {
        sku,
        name: 'Stock Toggle Tag',
        description: 'Test stock toggle',
        price: 500,
        image_url: 'POSTER 1.png',
        is_customizable: 1,
        in_stock: 1
      });
    }

    const product = createRes.data?.product || createRes.data?.data || createRes.data;
    const productId = product.id;
    t.assert(Boolean(productId), 'Product must be created with ID');

    // 3. Toggle Stock to OUT OF STOCK (false / 0)
    let toggleRes = await client.patch(`/api/admin/products/${productId}/stock`, { inStock: false, in_stock: 0 });
    if (toggleRes.status === 404) {
      toggleRes = await client.patch(`/api/products/${productId}/stock`, { inStock: false, in_stock: 0 });
    }
    if (toggleRes.status === 404) {
      toggleRes = await client.put(`/api/admin/products/${productId}`, { ...product, in_stock: 0, inStock: false });
    }

    t.assertStatus(toggleRes, 200, 'Stock toggle to out-of-stock should return 200 OK');

    // 4. Attempt to place an order for out-of-stock item
    client.clearAuth();
    const customerData = generateTestCustomer();
    const orderRes = await client.post('/api/orders', {
      items: [{ productId, quantity: 1 }],
      customer: customerData,
      shippingAddress: customerData.shippingAddress
    });

    t.assert(
      orderRes.status === 409 || orderRes.status === 400 || orderRes.status === 422,
      'Ordering out-of-stock product should be rejected with 409 Conflict / 400 Bad Request'
    );

    // 5. Toggle stock back to IN STOCK
    client.setToken(adminToken);
    let restockRes = await client.patch(`/api/admin/products/${productId}/stock`, { inStock: true, in_stock: 1 });
    if (restockRes.status === 404) {
      restockRes = await client.patch(`/api/products/${productId}/stock`, { inStock: true, in_stock: 1 });
    }
    if (restockRes.status === 404) {
      restockRes = await client.put(`/api/admin/products/${productId}`, { ...product, in_stock: 1, inStock: true });
    }

    t.assertStatus(restockRes, 200, 'Re-stock toggle should return 200 OK');

    // 6. Verify customer order now succeeds after restock
    client.clearAuth();
    const restockedOrderRes = await client.post('/api/orders', {
      items: [{ productId, quantity: 1, customText: 'Restocked Item' }],
      customer: customerData,
      shippingAddress: customerData.shippingAddress
    });

    t.assert(
      restockedOrderRes.status === 201 || restockedOrderRes.status === 200,
      'Customer order should succeed after item is restocked'
    );
  }
};
