/**
 * Tier 1 — Feature 8: Developer Admin Login
 * Verifies admin authentication, admin-scoped JWT, RBAC protection on admin routes,
 * and rejection of customer tokens on admin endpoints.
 */

const { generateUniqueEmail, DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD } = require('../helpers/cryptoHelper');

module.exports = {
  title: 'F8: Developer Admin Login & RBAC',
  featureId: 'F8',
  run: async (t, client) => {
    // 1. Admin login with valid credentials
    let adminLoginRes = await client.post('/api/auth/admin/login', {
      email: DEFAULT_ADMIN_EMAIL,
      password: DEFAULT_ADMIN_PASSWORD
    });

    if (adminLoginRes.status === 404) {
      adminLoginRes = await client.post('/api/auth/login', {
        email: DEFAULT_ADMIN_EMAIL,
        password: DEFAULT_ADMIN_PASSWORD
      });
    }

    t.assertStatus(adminLoginRes, 200, 'Admin login should succeed with 200 OK');
    const adminToken = adminLoginRes.data?.token || adminLoginRes.data?.accessToken;
    t.assert(Boolean(adminToken), 'Admin login must return a JWT token');

    const adminUser = adminLoginRes.data?.user || adminLoginRes.data?.data;
    t.assert(Boolean(adminUser), 'Admin login must return user object');
    t.assertEqual(adminUser.role, 'admin', 'Admin user must have role === "admin"');

    // 2. Admin token accessing protected admin stats route
    client.setToken(adminToken);
    const statsRes = await client.get('/api/admin/stats');
    t.assertStatus(statsRes, 200, 'Admin token should be able to access GET /api/admin/stats');
    t.assert(Boolean(statsRes.data?.stats || statsRes.data), 'Admin stats should return stats object');

    // 3. Register a regular customer and try accessing admin route
    const customerEmail = generateUniqueEmail('cust_not_admin');
    const custReg = await client.post('/api/auth/register', {
      email: customerEmail,
      password: 'CustPassword123!',
      name: 'Regular Customer'
    });
    const customerToken = custReg.data?.token || custReg.data?.accessToken;

    client.setToken(customerToken);
    const forbiddenRes = await client.get('/api/admin/stats');
    t.assert(
      forbiddenRes.status === 403 || forbiddenRes.status === 401,
      'Customer token accessing GET /api/admin/stats must be rejected with 403 Forbidden'
    );

    // 4. Unauthenticated access to admin routes
    client.clearAuth();
    const unauthAdminRes = await client.get('/api/admin/stats');
    t.assert(
      unauthAdminRes.status === 401 || unauthAdminRes.status === 403,
      'Unauthenticated access to /api/admin/stats must return 401/403'
    );

    // 5. Admin login with invalid password
    const badAdminLogin = await client.post('/api/auth/admin/login', {
      email: DEFAULT_ADMIN_EMAIL,
      password: 'IncorrectAdminPassword123!'
    });
    t.assert(
      badAdminLogin.status === 401 || badAdminLogin.status === 404,
      'Admin login with wrong password should return 401 Unauthorized'
    );
  }
};
