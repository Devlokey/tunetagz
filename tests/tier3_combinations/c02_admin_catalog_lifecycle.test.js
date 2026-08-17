/**
 * Tier 3 — Combination 2: Admin Catalog Management & Stock Toggle Lifecycle
 * Cross-feature pairwise workflow:
 * Admin Login -> Multer Upload Image -> Add Product -> Verify in Public Catalog ->
 * Toggle Stock to Out-of-Stock -> Customer Order Attempt Rejected -> Restock -> Customer Order Succeeds
 */

const { generateUniqueSku, generateTestCustomer, DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD } = require('../helpers/cryptoHelper');

module.exports = {
  title: 'C2: Admin Catalog & Stock Toggle Lifecycle Integration',
  run: async (t, client) => {
    // Step 1: Admin Login
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
    t.assert(Boolean(adminToken), 'Step 1: Admin authenticated');
    client.setToken(adminToken);

    // Step 2: Upload Image via Multer
    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    let uploadRes = await client.uploadFile('/api/products/upload', 'image', pngBuffer, 'combo_prod.png', 'image/png');
    if (uploadRes.status === 404) {
      uploadRes = await client.uploadFile('/api/admin/upload', 'image', pngBuffer, 'combo_prod.png', 'image/png');
    }
    const imageUrl = uploadRes.data?.imageUrl || 'POSTER 1.png';

    // Step 3: Create New Product
    const sku = generateUniqueSku('COMBO-KEY');
    const newProd = {
      sku,
      name: 'Cyberpunk Soundwave Tag',
      description: 'Futuristic neon acrylic soundwave keychain.',
      price: 799,
      image_url: imageUrl,
      is_customizable: 1,
      in_stock: 1
    };

    let createRes = await client.post('/api/admin/products', newProd);
    if (createRes.status === 404) createRes = await client.post('/api/products', newProd);
    t.assert(createRes.status === 201 || createRes.status === 200, 'Step 3: Product created');

    const createdProduct = createRes.data?.product || createRes.data?.data || createRes.data;
    const productId = createdProduct.id;

    // Step 4: Verify Product in Public Catalog
    client.clearAuth();
    const publicRes = await client.get('/api/products');
    t.assertStatus(publicRes, 200, 'Step 4: Public catalog fetched');
    const products = Array.isArray(publicRes.data) ? publicRes.data : publicRes.data?.data || publicRes.data?.products || [];
    const found = products.find(p => p.sku === sku || p.id === productId);
    t.assert(Boolean(found), 'Step 4: Product found in public catalog');

    // Step 5: Toggle Stock to OUT OF STOCK
    client.setToken(adminToken);
    let toggleRes = await client.patch(`/api/admin/products/${productId}/stock`, { inStock: false, in_stock: 0 });
    if (toggleRes.status === 404) toggleRes = await client.patch(`/api/products/${productId}/stock`, { inStock: false, in_stock: 0 });
    if (toggleRes.status === 404) toggleRes = await client.put(`/api/admin/products/${productId}`, { ...newProd, in_stock: 0, inStock: false });
    t.assertStatus(toggleRes, 200, 'Step 5: Stock toggled to out of stock');

    // Step 6: Customer Order Attempt Rejected
    client.clearAuth();
    const customer = generateTestCustomer();
    const badOrderRes = await client.post('/api/orders', {
      items: [{ productId, quantity: 1 }],
      customer,
      shippingAddress: customer.shippingAddress
    });
    t.assert(
      badOrderRes.status === 409 || badOrderRes.status === 400 || badOrderRes.status === 422,
      'Step 6: Customer order for out-of-stock product rejected'
    );

    // Step 7: Restock Product
    client.setToken(adminToken);
    let restockRes = await client.patch(`/api/admin/products/${productId}/stock`, { inStock: true, in_stock: 1 });
    if (restockRes.status === 404) restockRes = await client.patch(`/api/products/${productId}/stock`, { inStock: true, in_stock: 1 });
    if (restockRes.status === 404) restockRes = await client.put(`/api/admin/products/${productId}`, { ...newProd, in_stock: 1, inStock: true });
    t.assertStatus(restockRes, 200, 'Step 7: Product restocked');

    // Step 8: Customer Order Succeeds
    client.clearAuth();
    const goodOrderRes = await client.post('/api/orders', {
      items: [{ productId, quantity: 1, customText: 'Restocked Tag' }],
      customer,
      shippingAddress: customer.shippingAddress
    });
    t.assert(
      goodOrderRes.status === 201 || goodOrderRes.status === 200,
      'Step 8: Customer order succeeds after restock'
    );
  }
};
