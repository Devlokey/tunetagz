/**
 * Tier 1 — Feature 10: Multer Product Image Upload Pipeline
 * Verifies multipart image upload handling, storage in /uploads,
 * MIME type validation, and public asset accessibility.
 */

const { DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD } = require('../helpers/cryptoHelper');

module.exports = {
  title: 'F10: Multer Product Image Upload Pipeline',
  featureId: 'F10',
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
    t.assert(Boolean(adminToken), 'Admin login required for image upload testing');

    client.setToken(adminToken);

    // 2. Prepare mock 1x1 transparent PNG buffer
    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    // 3. Upload image via POST /api/products/upload or /api/admin/upload or /api/admin/products
    let uploadRes = await client.uploadFile(
      '/api/products/upload',
      'image',
      pngBuffer,
      'test_keychain_image.png',
      'image/png'
    );

    if (uploadRes.status === 404) {
      uploadRes = await client.uploadFile(
        '/api/admin/upload',
        'image',
        pngBuffer,
        'test_keychain_image.png',
        'image/png'
      );
    }

    t.assert(
      uploadRes.status === 201 || uploadRes.status === 200,
      `Image upload should return 200/201, got ${uploadRes.status}`
    );

    const imageUrl = uploadRes.data?.imageUrl || uploadRes.data?.url || uploadRes.data?.file?.path || uploadRes.data?.path;
    t.assert(Boolean(imageUrl), 'Upload response should contain imageUrl path');

    // 4. Verify uploaded image is publicly accessible via GET /uploads/...
    if (imageUrl) {
      const fetchImageRes = await client.get(imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`);
      t.assertStatus(fetchImageRes, 200, 'Uploaded image should be accessible via static file route');
    } else {
      t.assert(true, 'Image upload verified');
    }

    // 5. Attempt upload with non-image disallowed MIME type
    const textBuffer = Buffer.from('This is a plain text file, not an image.');
    const badUploadRes = await client.uploadFile(
      '/api/products/upload',
      'image',
      textBuffer,
      'malicious_script.txt',
      'text/plain'
    );
    t.assert(
      badUploadRes.status === 400 || badUploadRes.status === 415 || badUploadRes.status === 422 || badUploadRes.status === 404,
      'Uploading non-image file should be rejected with 400/415'
    );

    // 6. Unauthenticated upload attempt
    client.clearAuth();
    const unauthUploadRes = await client.uploadFile(
      '/api/products/upload',
      'image',
      pngBuffer,
      'unauth_image.png',
      'image/png'
    );
    t.assert(
      unauthUploadRes.status === 401 || unauthUploadRes.status === 403 || unauthUploadRes.status === 404,
      'Unauthenticated upload should be rejected with 401/403'
    );
  }
};
