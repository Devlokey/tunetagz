/**
 * Tier 2 — Boundary 3: Authentication & Privilege Escalation Defense
 * Exercises authorization security controls:
 * - Customer token attempting admin route access (horizontal/vertical escalation)
 * - SQL Injection in login parameters (' OR '1'='1)
 * - Forged JWT signed with arbitrary key
 * - Missing Authorization header
 */

const { generateUniqueEmail } = require('../helpers/cryptoHelper');
const crypto = require('crypto');

module.exports = {
  title: 'B3: Auth Security & Privilege Escalation Defense',
  run: async (t, client) => {
    // 1. Create a customer account
    const email = generateUniqueEmail('priv_esc_user');
    const regRes = await client.post('/api/auth/register', {
      email,
      password: 'CustomerPassword123!',
      name: 'Ordinary User'
    });
    const customerToken = regRes.data?.token || regRes.data?.accessToken;
    t.assert(Boolean(customerToken), 'Customer token obtained');

    // 2. Attack: Customer tries to access Admin Stats
    client.setToken(customerToken);
    const statsRes = await client.get('/api/admin/stats');
    t.assert(
      statsRes.status === 403 || statsRes.status === 401,
      'Vertical privilege escalation to /api/admin/stats must be blocked with 403 Forbidden'
    );

    // 3. Attack: Customer tries to access Admin Orders
    const adminOrdersRes = await client.get('/api/admin/orders');
    t.assert(
      adminOrdersRes.status === 403 || adminOrdersRes.status === 401,
      'Vertical privilege escalation to /api/admin/orders must be blocked with 403 Forbidden'
    );

    // 4. Attack: SQL Injection in login email
    client.clearToken();
    const sqliRes = await client.post('/api/auth/login', {
      email: "' OR 1=1 --",
      password: 'AnyPassword'
    });
    t.assert(
      sqliRes.status === 401 || sqliRes.status === 400,
      'SQL injection in login email must return 401/400 and NOT grant unauthorized login'
    );

    // 5. Attack: Forged JWT token with admin claim signed with wrong secret
    const fakeHeader = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const fakePayload = Buffer.from(JSON.stringify({ id: 1, email: 'hacker@attacker.com', role: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
    const fakeSig = crypto.createHmac('sha256', 'wrong_hacker_secret').update(`${fakeHeader}.${fakePayload}`).digest('base64url');
    const forgedToken = `${fakeHeader}.${fakePayload}.${fakeSig}`;

    client.setToken(forgedToken);
    const forgedAccessRes = await client.get('/api/admin/stats');
    t.assertStatus(forgedAccessRes, 401, 'Forged JWT signed with incorrect secret must be rejected with 401 Unauthorized');
    client.clearToken();
  }
};
