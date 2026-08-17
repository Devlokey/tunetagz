/**
 * Tier 1 — Feature 9: Public Product Catalog API
 * Verifies public product listing, product detail retrieval,
 * schema compliance, and 404 handling.
 */

module.exports = {
  title: 'F9: Public Product Catalog API',
  featureId: 'F9',
  run: async (t, client) => {
    // 1. Fetch public products catalog
    const res = await client.get('/api/products');
    t.assertStatus(res, 200, 'GET /api/products should return 200 OK');

    const products = Array.isArray(res.data) ? res.data : res.data?.data || res.data?.products || [];
    t.assert(Array.isArray(products), 'Products list must be an array');
    t.assert(products.length >= 1, 'Catalog should return at least one product');

    // 2. Validate product structure
    const sampleProduct = products[0];
    t.assert(sampleProduct.id !== undefined, 'Product must have an id');
    t.assert(typeof sampleProduct.name === 'string', 'Product name must be a string');
    t.assert(typeof sampleProduct.price === 'number', 'Product price must be a number');
    t.assert(sampleProduct.sku !== undefined, 'Product must have a sku');

    // 3. Fetch single product details by ID
    const singleRes = await client.get(`/api/products/${sampleProduct.id}`);
    t.assertStatus(singleRes, 200, `GET /api/products/${sampleProduct.id} should return 200 OK`);

    const singleProduct = singleRes.data?.data || singleRes.data?.product || singleRes.data;
    t.assertEqual(singleProduct.id, sampleProduct.id, 'Fetched product ID must match requested ID');
    t.assertEqual(singleProduct.sku, sampleProduct.sku, 'Fetched product SKU must match');

    // 4. Request non-existent product ID
    const missingRes = await client.get('/api/products/99999999');
    t.assertStatus(missingRes, 404, 'GET /api/products/99999999 should return 404 Not Found');

    // 5. Query parameter filter (e.g. ?inStock=true)
    const filteredRes = await client.get('/api/products?inStock=true');
    t.assertStatus(filteredRes, 200, 'GET /api/products with query filter should succeed');
  }
};
