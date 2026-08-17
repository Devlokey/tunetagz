/**
 * Tier 1 — Feature 23: Admin Dashboard & KPI Stats
 * Verifies GET /api/admin/stats for total sales, revenue, order counts,
 * and product counts under admin authorization.
 */

const { DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD } = require('../helpers/cryptoHelper');

module.exports = {
  title: 'F23: Admin Dashboard & KPI Stats API',
  featureId: 'F23',
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
    t.assert(Boolean(adminToken), 'Admin login required for stats test');

    client.setToken(adminToken);

    // 2. Fetch admin stats
    const statsRes = await client.get('/api/admin/stats');
    t.assertStatus(statsRes, 200, 'GET /api/admin/stats should return 200 OK');

    const stats = statsRes.data?.stats || statsRes.data?.data || statsRes.data;
    t.assert(Boolean(stats), 'Stats response must contain stats object');

    // 3. Verify statistical metrics exist
    t.assert(
      stats.totalSales !== undefined || stats.revenue !== undefined || stats.totalRevenue !== undefined,
      'Admin stats must include sales/revenue'
    );
    t.assert(
      stats.totalOrders !== undefined || stats.ordersCount !== undefined || stats.pendingOrders !== undefined,
      'Admin stats must include order counts'
    );
    t.assert(
      stats.totalProducts !== undefined || stats.productsCount !== undefined,
      'Admin stats must include product counts'
    );

    // 4. Unauthenticated access blocked
    client.clearAuth();
    const unauthStats = await client.get('/api/admin/stats');
    t.assert(
      unauthStats.status === 401 || unauthStats.status === 403,
      'GET /api/admin/stats without token must return 401/403'
    );
  }
};
