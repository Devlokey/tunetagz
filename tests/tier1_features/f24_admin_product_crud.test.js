/**
 * Tier 1 — Feature 24: Admin Product CRUD Management
 * Verifies admin creation, updating, deletion, and retrieval of products,
 * as well as public catalog synchronization.
 */

const { generateUniqueSku, DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD } = require('../helpers/cryptoHelper');

module.exports = {
  title: 'F24: Admin Product CRUD Management',
  featureId: 'F24',
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
    t.assert(Boolean(adminToken), 'Admin login required for CRUD test');
    client.setToken(adminToken);

    // 2. CREATE a new product
    const sku = generateUniqueSku('CRUD-PROD');
    const newProductPayload = {
      sku,
      name: 'Titanium Spotify Tag',
      description: 'Ultra-durable aerospace-grade titanium tag with laser precision.',
      price: 899,
      original_price: 1199,
      badge: 'Limited Edition',
      image_url: 'POSTER 1.png',
      is_customizable: 1,
      in_stock: 1
    };

    let createRes = await client.post('/api/admin/products', newProductPayload);
    if (createRes.status === 404) {
      createRes = await client.post('/api/products', newProductPayload);
    }

    t.assert(
      createRes.status === 201 || createRes.status === 200,
      `Product creation should succeed with 201/200, got ${createRes.status}`
    );

    const createdProduct = createRes.data?.product || createRes.data?.data || createRes.data;
    const productId = createdProduct.id;
    t.assert(Boolean(productId), 'Created product must have ID');

    // 3. READ: Verify in public catalog
    const publicCatalog = await client.get('/api/products');
    const products = Array.isArray(publicCatalog.data) ? publicCatalog.data : publicCatalog.data?.data || publicCatalog.data?.products || [];
    const found = products.find(p => p.sku === sku || p.id === productId);
    t.assert(Boolean(found), 'Newly created product must appear in public catalog');
    t.assertEqual(Number(found.price), 899, 'Product price in catalog must match created price');

    // 4. UPDATE the product price & description
    const updatePayload = {
      ...newProductPayload,
      price: 949,
      description: 'Updated description for titanium tag.'
    };

    let updateRes = await client.put(`/api/admin/products/${productId}`, updatePayload);
    if (updateRes.status === 404) {
      updateRes = await client.put(`/api/products/${productId}`, updatePayload);
    }

    t.assertStatus(updateRes, 200, 'Product update should return 200 OK');

    // 5. DELETE the product
    let deleteRes = await client.delete(`/api/admin/products/${productId}`);
    if (deleteRes.status === 404) {
      deleteRes = await client.delete(`/api/products/${productId}`);
    }

    t.assert(
      deleteRes.status === 200 || deleteRes.status === 204,
      `Product deletion should return 200/204, got ${deleteRes.status}`
    );
  }
};
