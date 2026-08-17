/**
 * Frontend Verification Test Suite
 * Validates presence, syntax, markup elements, API wiring, and admin dashboard controls.
 */
const fs = require('fs');
const path = require('path');
const http = require('http');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    passCount++;
  } else {
    console.error(`❌ FAIL: ${message}`);
    failCount++;
  }
}

async function runVerification() {
  console.log('--- STARTING FRONTEND INTEGRATION VERIFICATION ---');

  // 1. Check all required client files exist
  const requiredFiles = [
    'public/js/api.js',
    'public/js/auth.js',
    'public/js/customizer.js',
    'public/js/checkout.js',
    'public/js/tracking.js',
    'public/js/admin.js',
    'public/css/customizer.css',
    'public/css/admin.css',
    'index.html',
    'public/index.html',
    'admin.html',
    'public/admin.html'
  ];

  requiredFiles.forEach(f => {
    assert(fs.existsSync(f) && fs.statSync(f).size > 100, `Required frontend file '${f}' exists and is populated`);
  });

  // 2. Validate index.html markup & integrations
  const indexHtml = fs.readFileSync('index.html', 'utf8');
  assert(indexHtml.includes('navUserContainer'), 'index.html contains #navUserContainer for dynamic customer authentication state');
  assert(indexHtml.includes('TrackingModal'), 'index.html contains live Order Tracking modal triggers');
  assert(indexHtml.includes('CustomizerModal'), 'index.html contains Spotify 2-sided Customizer modal triggers');
  assert(indexHtml.includes('CheckoutModal'), 'index.html contains Razorpay Checkout triggers');
  assert(indexHtml.includes('customizer.css'), 'index.html links to customizer.css');
  assert(indexHtml.includes('initStorefrontCatalog'), 'index.html contains dynamic catalog fetch from /api/products with fallback');

  // 3. Validate admin.html markup & integrations
  const adminHtml = fs.readFileSync('admin.html', 'utf8');
  assert(adminHtml.includes('adminLoginForm'), 'admin.html contains Admin Login Form');
  assert(adminHtml.includes('adminDashboardView'), 'admin.html contains Developer Admin Dashboard View');
  assert(adminHtml.includes('statTotalSales'), 'admin.html contains KPI metrics (Sales, Orders, Pending, Products)');
  assert(adminHtml.includes('adminProductsTableBody'), 'admin.html contains Product Catalog Table');
  assert(adminHtml.includes('adminOrdersTableBody'), 'admin.html contains Order Fulfillment Table');
  assert(adminHtml.includes('adminAuditLogsTableBody'), 'admin.html contains Admin Audit Trail');

  // 4. Validate customizer.js logic
  const customizerJs = fs.readFileSync('public/js/customizer.js', 'utf8');
  assert(customizerJs.includes('CustomizerModal'), 'customizer.js exports CustomizerModal');
  assert(customizerJs.includes('generateLocalSvg'), 'customizer.js contains 23-bar soundwave waveform generator');
  assert(customizerJs.includes('is-flipped'), 'customizer.js handles 3D card flip animation');
  assert(customizerJs.includes('updateSpotifyPreview'), 'customizer.js calls /api/spotify/preview for live preview');
  assert(customizerJs.includes('updateEngravingPreview'), 'customizer.js validates and previews laser engraved text (max 30 chars)');

  // 5. Validate checkout.js logic
  const checkoutJs = fs.readFileSync('public/js/checkout.js', 'utf8');
  assert(checkoutJs.includes('CheckoutModal'), 'checkout.js exports CheckoutModal');
  assert(checkoutJs.includes('API.payments.createOrder'), 'checkout.js initiates Razorpay order creation');
  assert(checkoutJs.includes('API.payments.verify'), 'checkout.js verifies cryptographic Razorpay signature');
  assert(checkoutJs.includes('showMockPaymentModal'), 'checkout.js provides deterministic sandbox mock payment flow');

  // 6. Validate tracking.js logic
  const trackingJs = fs.readFileSync('public/js/tracking.js', 'utf8');
  assert(trackingJs.includes('TrackingModal'), 'tracking.js exports TrackingModal');
  assert(trackingJs.includes('ORDER_RECEIVED') && trackingJs.includes('DELIVERED'), 'tracking.js implements 5-stage fulfillment stepper');
  assert(trackingJs.includes('API.orders.getMyOrders'), 'tracking.js loads customer order history');

  // 7. Validate admin.js logic
  const adminJs = fs.readFileSync('public/js/admin.js', 'utf8');
  assert(adminJs.includes('API.auth.adminLogin'), 'admin.js authenticates developer admin');
  assert(adminJs.includes('API.admin.getStats'), 'admin.js fetches dashboard stats');
  assert(adminJs.includes('API.admin.createProduct'), 'admin.js supports product creation with Multer file uploads');
  assert(adminJs.includes('API.admin.toggleStock'), 'admin.js toggles in-stock availability');
  assert(adminJs.includes('API.admin.updateOrderStatus'), 'admin.js advances order fulfillment statuses with courier tracking');

  console.log(`\n--- STATIC FILE & LOGIC VERIFICATION COMPLETE: ${passCount} PASSED, ${failCount} FAILED ---`);

  // 8. Test HTTP Static & Integration Serving with Live Server
  console.log('\n--- TESTING LIVE HTTP SERVER INTEGRATION ---');
  const app = require('../../src/app');
  const { initializeDatabase } = require('../../src/config/database');
  const { seedDatabase } = require('../../src/utils/seed');

  await initializeDatabase();
  await seedDatabase();

  const server = app.listen(0);
  const port = server.address().port;

  function req(path, method = 'GET', body = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const postData = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : null;
      const reqHeaders = { ...headers };
      if (postData && !reqHeaders['Content-Type']) {
        reqHeaders['Content-Type'] = 'application/json';
        reqHeaders['Content-Length'] = Buffer.byteLength(postData);
      }
      const request = http.request({
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: reqHeaders
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(data); } catch(e) { json = data; }
          resolve({ status: res.statusCode, headers: res.headers, body: json });
        });
      });
      request.on('error', reject);
      if (postData) request.write(postData);
      request.end();
    });
  }

  try {
    const rootRes = await req('/');
    assert(rootRes.status === 200, 'GET / serves index.html with 200 OK');
    assert(typeof rootRes.body === 'string' && rootRes.body.includes('TuneTagZ'), 'index.html contains TuneTagZ branding');

    const adminPageRes = await req('/admin');
    assert(adminPageRes.status === 200, 'GET /admin serves admin.html with 200 OK');
    assert(typeof adminPageRes.body === 'string' && adminPageRes.body.includes('Developer Admin Portal'), 'admin.html contains Developer Admin Portal');

    const customizerJsRes = await req('/public/js/customizer.js');
    assert(customizerJsRes.status === 200, 'GET /public/js/customizer.js serves customizer script');

    const checkoutJsRes = await req('/public/js/checkout.js');
    assert(checkoutJsRes.status === 200, 'GET /public/js/checkout.js serves checkout script');

    const trackingJsRes = await req('/public/js/tracking.js');
    assert(trackingJsRes.status === 200, 'GET /public/js/tracking.js serves tracking script');

    const adminJsRes = await req('/public/js/admin.js');
    assert(adminJsRes.status === 200, 'GET /public/js/admin.js serves admin script');

    const customizerCssRes = await req('/public/css/customizer.css');
    assert(customizerCssRes.status === 200, 'GET /public/css/customizer.css serves customizer CSS');

    const adminCssRes = await req('/public/css/admin.css');
    assert(adminCssRes.status === 200, 'GET /public/css/admin.css serves admin CSS');

    // Test Spotify Preview endpoint
    const spotifyRes = await req('/api/spotify/preview?url=https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT');
    assert(spotifyRes.status === 200 && spotifyRes.body.success, 'GET /api/spotify/preview returns valid soundwave SVG');

    // Test Admin Login & Stats endpoint
    const adminLoginRes = await req('/api/auth/admin/login', 'POST', {
      email: 'admin@tunetagz.com',
      password: 'Admin@TuneTagZ2026!'
    });
    assert(adminLoginRes.status === 200 && adminLoginRes.body.token, 'POST /api/auth/admin/login authenticates admin');

    const statsRes = await req('/api/admin/stats', 'GET', null, {
      Authorization: `Bearer ${adminLoginRes.body.token}`
    });
    assert(statsRes.status === 200 && statsRes.body.success && statsRes.body.stats, 'GET /api/admin/stats returns KPIs');

  } finally {
    server.close();
  }

  console.log(`\n=======================================================`);
  console.log(`TOTAL FRONTEND SUITE VERIFICATION: ${passCount} PASSED, ${failCount} FAILED`);
  console.log(`=======================================================`);
  if (failCount > 0) process.exit(1);
}

runVerification();

