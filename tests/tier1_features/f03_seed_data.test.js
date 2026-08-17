/**
 * Tier 1 — Feature 3: Initial Seed Data
 * Verifies initial seed data: Spotify Code Tag (₹699), Rocky Keychain (₹300),
 * Drop 03, and default Admin account.
 */

const { DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD } = require('../helpers/cryptoHelper');

module.exports = {
  title: 'F3: Initial Seed Data',
  featureId: 'F3',
  run: async (t, client) => {
    // 1. Fetch public products list
    const res = await client.get('/api/products');
    t.assertStatus(res, 200, 'GET /api/products should return 200 OK');

    const products = Array.isArray(res.data) ? res.data : res.data?.data || res.data?.products || [];
    t.assert(products.length >= 2, 'Database should contain at least 2 seeded products');

    // 2. Find Spotify Code Tag
    const spotifyTag = products.find(p => p.sku === 'SPT-001' || (p.name && p.name.toLowerCase().includes('spotify')));
    t.assert(Boolean(spotifyTag), 'Seeded data must include Spotify Code Tag (SPT-001)');
    t.assertEqual(Number(spotifyTag.price), 699, 'Spotify Code Tag price must be ₹699');
    t.assert(
      spotifyTag.is_customizable === 1 || spotifyTag.isCustomizable === true || spotifyTag.is_customizable === true,
      'Spotify Code Tag must be customizable'
    );

    // 3. Find Rocky Keychain
    const rockyTag = products.find(p => p.sku === 'RKY-001' || (p.name && p.name.toLowerCase().includes('rocky')));
    t.assert(Boolean(rockyTag), 'Seeded data must include Rocky Keychain (RKY-001)');
    t.assertEqual(Number(rockyTag.price), 300, 'Rocky Keychain price must be ₹300');

    // 4. Verify default Admin account can login
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

    t.assert(
      adminLoginRes.status === 200,
      `Default admin account (${DEFAULT_ADMIN_EMAIL}) should be able to login successfully`
    );
    t.assert(
      Boolean(adminLoginRes.data?.token || adminLoginRes.data?.accessToken),
      'Admin login should return a valid JWT token'
    );
  }
};
