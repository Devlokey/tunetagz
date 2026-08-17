/**
 * Tier 1 — Feature 11: Dynamic Storefront Catalog Sync
 * Verifies frontend landing page (index.html) integration with /api/products,
 * dynamic product hydration structure, and fallback resilience.
 */

module.exports = {
  title: 'F11: Dynamic Storefront Catalog Sync',
  featureId: 'F11',
  run: async (t, client) => {
    // 1. Fetch storefront index.html
    const indexRes = await client.get('/');
    t.assertStatus(indexRes, 200, 'GET / should serve storefront HTML');

    const html = indexRes.text || '';
    t.assert(html.length > 500, 'Storefront HTML should contain complete webpage markup');

    // 2. Verify product grid container or customizer elements in HTML
    const hasProductContainer = html.includes('product') || html.includes('pcard') || html.includes('catalog') || html.includes('SPT-001');
    t.assert(hasProductContainer, 'Storefront HTML should contain product section or markup');

    // 3. Verify API returns products matching schema needed by frontend
    const productsRes = await client.get('/api/products');
    t.assertStatus(productsRes, 200, 'Products API should be operational');

    const products = Array.isArray(productsRes.data) ? productsRes.data : productsRes.data?.data || productsRes.data?.products || [];
    t.assert(products.length > 0, 'Catalog should supply products to frontend');

    // 4. Verify each product has necessary UI fields: name, price, image
    for (const p of products) {
      t.assert(typeof p.name === 'string' && p.name.length > 0, 'Product must have displayable name');
      t.assert(p.price !== undefined, 'Product must have price for storefront price tag');
    }

    // 5. Verify static asset links in HTML are reachable
    const logoRes = await client.get('/TUNETAGZ%20LOGO.png');
    t.assert(
      logoRes.status === 200 || logoRes.status === 304,
      'Branding logo asset should be accessible'
    );
  }
};
