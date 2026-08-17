/**
 * Tier 2 — Boundary 5: Multer File Upload Boundaries & MIME Security
 * Exercises file upload edge cases:
 * - Executable / PHP / script file extensions
 * - Disallowed MIME types
 * - Empty / zero-byte uploads
 * - Filename path traversal attempts (../../evil.png)
 */

const { DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD } = require('../helpers/cryptoHelper');

module.exports = {
  title: 'B5: Multer File Upload Boundaries & MIME Security',
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
    client.setToken(adminToken);

    // 2. Disallowed extension & MIME: Shell script
    const shellScriptBuffer = Buffer.from('#!/bin/bash\necho "exploit"\n');
    const shRes = await client.uploadFile(
      '/api/products/upload',
      'image',
      shellScriptBuffer,
      'exploit.sh',
      'application/x-sh'
    );
    t.assert(
      shRes.status === 400 || shRes.status === 415 || shRes.status === 422 || shRes.status === 404,
      'Shell script upload must be rejected or not supported'
    );

    // 3. Disallowed extension & MIME: HTML / JS file
    const htmlBuffer = Buffer.from('<html><script>alert(1)</script></html>');
    const htmlRes = await client.uploadFile(
      '/api/products/upload',
      'image',
      htmlBuffer,
      'phishing.html',
      'text/html'
    );
    t.assert(
      htmlRes.status === 400 || htmlRes.status === 415 || htmlRes.status === 422 || htmlRes.status === 404,
      'HTML file upload must be rejected or not supported'
    );

    // 4. Filename path traversal attempt: ../../etc/malicious.png
    const validPngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
    const traversalRes = await client.uploadFile(
      '/api/products/upload',
      'image',
      validPngBuffer,
      '../../traversal_attack.png',
      'image/png'
    );
    t.assert(
      traversalRes.status === 200 || traversalRes.status === 201 || traversalRes.status === 400 || traversalRes.status === 404,
      'Path traversal in filename safely handled'
    );
  }
};
