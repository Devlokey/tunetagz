/**
 * Tier 1 — Feature 5: Customer Login
 * Verifies email/password login, credential validation, JWT token issuance,
 * and error handling for bad credentials.
 */

const { generateUniqueEmail } = require('../helpers/cryptoHelper');

module.exports = {
  title: 'F5: Customer Email/Password Login',
  featureId: 'F5',
  run: async (t, client) => {
    const email = generateUniqueEmail('login_test');
    const password = 'CorrectPassword99!';
    const name = 'Priya Patel';

    // 1. Create a customer to test login against
    const regRes = await client.post('/api/auth/register', {
      email,
      password,
      name
    });
    t.assert(regRes.status === 201 || regRes.status === 200, 'Pre-registration for login test should succeed');

    // 2. Successful login with correct credentials
    const loginRes = await client.post('/api/auth/login', {
      email,
      password
    });
    t.assertStatus(loginRes, 200, 'Login with correct credentials should return 200 OK');

    const token = loginRes.data?.token || loginRes.data?.accessToken;
    t.assert(Boolean(token), 'Login response must include JWT token');

    const user = loginRes.data?.user || loginRes.data?.data;
    t.assert(Boolean(user), 'Login response must include user profile object');
    t.assertEqual(user.email.toLowerCase(), email.toLowerCase(), 'Login user email should match');

    // 3. Login with incorrect password
    const badPassRes = await client.post('/api/auth/login', {
      email,
      password: 'WrongPassword123!'
    });
    t.assertStatus(badPassRes, 401, 'Login with wrong password should return 401 Unauthorized');

    // 4. Login with non-existent email
    const nonExistRes = await client.post('/api/auth/login', {
      email: 'non_existent_email_123456@example.com',
      password: 'SomePassword123!'
    });
    t.assertStatus(nonExistRes, 401, 'Login with non-existent email should return 401 Unauthorized');

    // 5. Login with missing password
    const missingPassRes = await client.post('/api/auth/login', {
      email
    });
    t.assertStatus(missingPassRes, 400, 'Login with missing password should return 400 Bad Request');

    // 6. Login with missing email
    const missingEmailRes = await client.post('/api/auth/login', {
      password
    });
    t.assertStatus(missingEmailRes, 400, 'Login with missing email should return 400 Bad Request');
  }
};
