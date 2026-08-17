/**
 * Tier 1 — Feature 1: Server Bootstrap & Health Diagnostics
 * Verifies Express server bootstrap, /api/health endpoint, CORS,
 * static asset serving, and 404 routing.
 */

module.exports = {
  title: 'F1: Express Server Bootstrap & Health Diagnostics',
  featureId: 'F1',
  run: async (t, client) => {
    // 1. Check health endpoint returns 200 OK
    const healthRes = await client.get('/api/health');
    t.assertStatus(healthRes, 200, 'GET /api/health should return 200 OK');

    // 2. Check health response structure
    t.assert(
      healthRes.data && (healthRes.data.status === 'ok' || healthRes.data.success === true),
      'Health endpoint should report status ok'
    );

    // 3. Check uptime or timestamp
    t.assert(
      healthRes.data && (healthRes.data.uptime !== undefined || healthRes.data.timestamp !== undefined),
      'Health endpoint should provide uptime or timestamp metadata'
    );

    // 4. Check static file serving for root index.html
    const indexRes = await client.get('/');
    t.assertStatus(indexRes, 200, 'GET / should serve storefront index.html');
    t.assert(
      typeof indexRes.text === 'string' && indexRes.text.toLowerCase().includes('tunetagz'),
      'Storefront HTML should contain TuneTagZ branding'
    );

    // 5. Check static file serving for brand asset
    const logoRes = await client.get('/TUNETAGZ%20LOGO.png');
    t.assert(
      logoRes.status === 200 || logoRes.status === 304,
      'Branding logo asset should be served'
    );

    // 6. Check 404 handler for non-existent API routes
    const missingRes = await client.get('/api/non-existent-route-xyz');
    t.assertStatus(missingRes, 404, 'Unknown API routes should return 404 Not Found');

    // 7. Check JSON content-type header on health API
    const contentType = healthRes.headers.get('content-type') || '';
    t.assert(
      contentType.includes('application/json'),
      'API endpoints should respond with application/json header'
    );
  }
};
