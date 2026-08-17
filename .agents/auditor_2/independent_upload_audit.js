const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { HttpClient } = require('../../tests/helpers/httpClient');
const { startServer, stopServer } = require('../../tests/helpers/serverHelper');
const { DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD } = require('../../tests/helpers/cryptoHelper');

async function testUploadIntegrity() {
  console.log('=== TESTING MULTER FILE UPLOAD INTEGRITY ===');
  const server = await startServer(3000);
  const client = new HttpClient(server.baseUrl);

  try {
    // 1. Authenticate as Developer Admin
    const adminLogin = await client.post('/api/auth/admin/login', {
      email: DEFAULT_ADMIN_EMAIL,
      password: DEFAULT_ADMIN_PASSWORD
    });
    assert(adminLogin.status === 200, 'Admin login must succeed');
    const adminToken = adminLogin.data.token;
    client.setToken(adminToken);

    // 2. Upload valid PNG image
    const testPngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAEklEQVR42mNk+M9QzwAEjAwMDAUAAW8B/4iY+AAAAABJRU5ErkJggg==',
      'base64'
    );

    const uploadRes = await client.uploadFile(
      '/api/products/upload',
      'image',
      testPngBuffer,
      'forensic_test.png',
      'image/png'
    );

    assert(uploadRes.status === 201, 'Image upload must return HTTP 201 Created');
    assert(uploadRes.data && uploadRes.data.imageUrl, 'Response must return imageUrl');
    const imageUrl = uploadRes.data.imageUrl;
    console.log('  ✔ Multer endpoint returned 201 Created with path: ' + imageUrl);

    // 3. Verify physical file on disk in uploads/ folder
    const diskPath = path.join(__dirname, '../../', imageUrl.replace(/^\//, ''));
    assert(fs.existsSync(diskPath), 'Uploaded file must physically exist at ' + diskPath);
    const diskBytes = fs.readFileSync(diskPath);
    assert.strictEqual(diskBytes.length, testPngBuffer.length, 'File size on disk must match uploaded buffer');
    console.log('  ✔ Verified physical file on filesystem at ' + diskPath + ' (' + diskBytes.length + ' bytes)');

    // 4. Verify public static HTTP serving of the uploaded file
    const fetchFile = await client.get(imageUrl);
    assert.strictEqual(fetchFile.status, 200, 'Uploaded file must be publicly downloadable via HTTP');
    console.log('  ✔ Verified HTTP static serving of /uploads path (HTTP 200 OK)');

    // 5. Verify disallowed MIME type rejection (e.g. text/html)
    const badBuffer = Buffer.from('<script>alert("xss")</script>');
    const badUpload = await client.uploadFile(
      '/api/products/upload',
      'image',
      badBuffer,
      'exploit.html',
      'text/html'
    );
    assert(badUpload.status === 415 || badUpload.status === 400, 'Disallowed MIME type must be rejected with 415/400');
    console.log('  ✔ Disallowed MIME type (text/html) correctly rejected with HTTP ' + badUpload.status);

    // Clean up test file
    try {
      fs.unlinkSync(diskPath);
    } catch (e) {}

    console.log('\n=== MULTER INTEGRITY AUDIT PASSED CLEANLY ===\n');
  } finally {
    stopServer();
  }
}

testUploadIntegrity().catch(err => {
  console.error('\n❌ MULTER AUDIT FAILURE:', err);
  stopServer();
  process.exit(1);
});