/**
 * Tier 1 — Feature 7: Customer Session & Profile
 * Verifies GET /api/auth/me for authenticated users, token authorization,
 * unauthenticated rejection, and logout functionality.
 */

const { generateUniqueEmail } = require('../helpers/cryptoHelper');

module.exports = {
  title: 'F7: Customer Session & Profile',
  featureId: 'F7',
  run: async (t, client) => {
    const email = generateUniqueEmail('profile_user');
    const password = 'TestPassword123!';
    const name = 'Vikram Malhotra';

    // 1. Register a user to obtain a valid token
    const regRes = await client.post('/api/auth/register', {
      email,
      password,
      name
    });
    const token = regRes.data?.token || regRes.data?.accessToken;
    t.assert(Boolean(token), 'User registration must provide token for profile testing');

    // 2. Query /api/auth/me with Bearer token
    client.setToken(token);
    const meRes = await client.get('/api/auth/me');
    t.assertStatus(meRes, 200, 'GET /api/auth/me with valid Bearer token should return 200 OK');

    const profile = meRes.data?.user || meRes.data?.data || meRes.data;
    t.assert(Boolean(profile), 'Profile response should contain user object');
    t.assertEqual(profile.email.toLowerCase(), email.toLowerCase(), 'Profile email must match authenticated user');
    t.assertEqual(profile.name, name, 'Profile name must match registered name');

    // 3. Query /api/auth/me without token -> 401 Unauthorized
    client.clearAuth();
    const unauthRes = await client.get('/api/auth/me');
    t.assertStatus(unauthRes, 401, 'GET /api/auth/me without token should return 401 Unauthorized');

    // 4. Query /api/auth/me with corrupted / invalid token -> 401 Unauthorized
    client.setToken('malformed.fake.jwt.token');
    const invalidTokenRes = await client.get('/api/auth/me');
    t.assertStatus(invalidTokenRes, 401, 'GET /api/auth/me with invalid token should return 401 Unauthorized');
    client.clearAuth();

    // 5. Test logout endpoint
    client.setToken(token);
    const logoutRes = await client.post('/api/auth/logout', {});
    t.assert(
      logoutRes.status === 200 || logoutRes.status === 204,
      'POST /api/auth/logout should return 200/204'
    );
    client.clearAuth();
  }
};
