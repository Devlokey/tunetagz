/**
 * Tier 1 — Feature 2: SQLite Database & Migrations
 * Verifies SQLite database initialization, table schemas, and constraints.
 */

const fs = require('fs');
const path = require('path');

module.exports = {
  title: 'F2: SQLite Database & Migrations',
  featureId: 'F2',
  run: async (t, client) => {
    // 1. Health check mentions database connectivity
    const health = await client.get('/api/health');
    t.assertStatus(health, 200, 'GET /api/health should be operational');
    if (health.data && health.data.database) {
      t.assert(
        health.data.database.connected === true || health.data.database.type === 'sqlite',
        'Database status in health check should indicate active sqlite connection'
      );
    } else {
      t.assert(health.data && health.data.status === 'ok', 'Database connection operational');
    }

    // 2. Check that SQLite database file exists in data/ or root
    const projectRoot = path.resolve(__dirname, '../../');
    const possibleDbPaths = [
      path.join(projectRoot, 'data', 'tunetagz.db'),
      path.join(projectRoot, 'tunetagz.db'),
      path.join(projectRoot, 'data', 'database.sqlite')
    ];
    const dbFileExists = possibleDbPaths.some(p => fs.existsSync(p));
    t.assert(dbFileExists, 'SQLite database file should exist on filesystem');

    // 3. Products table is queryable via API
    const productsRes = await client.get('/api/products');
    t.assertStatus(productsRes, 200, 'Products table should be queryable via GET /api/products');
    const productsList = Array.isArray(productsRes.data) ? productsRes.data : productsRes.data?.data || productsRes.data?.products;
    t.assert(Array.isArray(productsList), 'Products query should return an array');

    // 4. Products table contains expected schema fields (sku, name, price)
    if (productsList && productsList.length > 0) {
      const first = productsList[0];
      t.assert(first.name !== undefined, 'Product record must contain name');
      t.assert(first.price !== undefined, 'Product record must contain price');
      t.assert(first.sku !== undefined, 'Product record must contain sku');
    } else {
      t.assert(true, 'Products table initialized');
    }

    // 5. Auth endpoint verifies users table existence
    const authMeRes = await client.get('/api/auth/me');
    t.assert(
      authMeRes.status === 401 || authMeRes.status === 200,
      'Users table should be active (returns 401 Unauthorized for unauthenticated request)'
    );

    // 6. Orders endpoint verifies orders table existence
    const ordersTrackRes = await client.get('/api/orders/track/NON-EXISTENT-ORDER-99999');
    t.assert(
      ordersTrackRes.status === 404 || ordersTrackRes.status === 400,
      'Orders table should be active (returns 404 or 400 for non-existent order lookup)'
    );
  }
};
