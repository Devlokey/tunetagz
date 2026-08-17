/**
 * Tier 1 — Feature 4: Customer Registration
 * Verifies customer registration, bcrypt hashing, input validation,
 * duplicate handling, and token generation.
 */

const { generateUniqueEmail } = require('../helpers/cryptoHelper');

module.exports = {
  title: 'F4: Customer Email/Password Registration',
  featureId: 'F4',
  run: async (t, client) => {
    const email = generateUniqueEmail('reg_customer');
    const password = 'StrongPassword123!';
    const name = 'Rajesh Kumar';
    const phone = '+919876543210';

    // 1. Successful registration
    const res = await client.post('/api/auth/register', {
      email,
      password,
      name,
      phone
    });

    t.assert(
      res.status === 201 || res.status === 200,
      `Registration should succeed with 201/200, got ${res.status}`
    );

    const token = res.data?.token || res.data?.accessToken;
    t.assert(Boolean(token), 'Registration response should contain JWT token');

    const user = res.data?.user || res.data?.data;
    t.assert(Boolean(user), 'Registration response should contain user profile');
    t.assertEqual(user.email.toLowerCase(), email.toLowerCase(), 'Registered email should match');
    t.assertEqual(user.name, name, 'Registered name should match');
    t.assert(user.role === 'customer' || !user.role, 'User role should default to customer');

    // 2. Password hash security: must NOT leak in response
    t.assert(user.password === undefined, 'Password must not be returned in API response');
    t.assert(user.password_hash === undefined, 'Password hash must not be returned in API response');

    // 3. Duplicate email registration conflict
    const dupRes = await client.post('/api/auth/register', {
      email,
      password: 'AnotherPassword456!',
      name: 'Duplicate User'
    });
    t.assert(
      dupRes.status === 409 || dupRes.status === 400,
      'Duplicate email registration should be rejected with 409 Conflict or 400 Bad Request'
    );

    // 4. Invalid email format rejection
    const badEmailRes = await client.post('/api/auth/register', {
      email: 'not-a-valid-email',
      password: 'StrongPassword123!',
      name: 'Bad Email User'
    });
    t.assertStatus(badEmailRes, 400, 'Invalid email format should be rejected with 400 Bad Request');

    // 5. Short/empty password rejection
    const badPassRes = await client.post('/api/auth/register', {
      email: generateUniqueEmail('short_pass'),
      password: '123',
      name: 'Short Pass User'
    });
    t.assertStatus(badPassRes, 400, 'Short password (<6 chars) should be rejected with 400 Bad Request');
  }
};
