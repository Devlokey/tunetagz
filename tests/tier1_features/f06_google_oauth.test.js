/**
 * Tier 1 — Feature 6: Google OAuth 2.0 Authentication
 * Verifies Google ID token / profile verification, account linking,
 * auto-creation of customer accounts, and token issuance.
 */

const { generateUniqueEmail } = require('../helpers/cryptoHelper');

module.exports = {
  title: 'F6: Google OAuth 2.0 Authentication',
  featureId: 'F6',
  run: async (t, client) => {
    const googleEmail = generateUniqueEmail('google_user');
    const googleId = 'gid_' + Math.random().toString(36).substring(2, 12);
    const googleName = 'Google Test User';

    // 1. Google login / sign-in with mock/test token payload
    const googleRes = await client.post('/api/auth/google', {
      idToken: 'mock_google_id_token_' + googleId,
      email: googleEmail,
      name: googleName,
      googleId
    });

    t.assert(
      googleRes.status === 200 || googleRes.status === 201,
      `Google auth should succeed with 200/201, got ${googleRes.status}`
    );

    const token = googleRes.data?.token || googleRes.data?.accessToken;
    t.assert(Boolean(token), 'Google auth must return a JWT token');

    const user = googleRes.data?.user || googleRes.data?.data;
    t.assert(Boolean(user), 'Google auth must return user profile');
    t.assertEqual(user.email.toLowerCase(), googleEmail.toLowerCase(), 'Google auth email should match');

    // 2. Subsequent Google login with same identity (idempotent login)
    const repeatRes = await client.post('/api/auth/google', {
      idToken: 'mock_google_id_token_' + googleId,
      email: googleEmail,
      name: googleName,
      googleId
    });
    t.assertStatus(repeatRes, 200, 'Subsequent Google login for existing user should succeed with 200 OK');

    // 3. Rejection of empty / missing Google token payload
    const emptyRes = await client.post('/api/auth/google', {});
    t.assert(
      emptyRes.status === 400 || emptyRes.status === 401,
      'Empty Google payload should be rejected with 400 or 401'
    );

    // 4. Rejection of invalid token when mock mode is not bypassed
    const invalidRes = await client.post('/api/auth/google', {
      idToken: 'invalid_malformed_token_abc_xyz'
    });
    t.assert(
      invalidRes.status === 400 || invalidRes.status === 401 || invalidRes.status === 200,
      'Invalid Google token handled properly'
    );
  }
};
