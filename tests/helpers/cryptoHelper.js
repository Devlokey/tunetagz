/**
 * TuneTagZ Test Suite — Crypto & Test Data Helper
 * Provides Razorpay HMAC signature generation, JWT generation,
 * unique test identifiers, and sample payloads.
 */

require('dotenv').config();
const crypto = require('crypto');

const DEFAULT_RAZORPAY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'rzp_test_TuneTagZ2026Secret';
const DEFAULT_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'rzp_webhook_secret_2026';
const DEFAULT_ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@tunetagz.com').toLowerCase().trim();
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@TuneTagZ2026!';

/**
 * Generates valid HMAC-SHA256 signature for Razorpay verification
 * Formula: HMAC_SHA256(order_id + "|" + payment_id, secret)
 */
function generateRazorpaySignature(orderId, paymentId, secret = DEFAULT_RAZORPAY_SECRET) {
  const payload = `${orderId}|${paymentId}`;
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

/**
 * Generates valid HMAC-SHA256 signature for Razorpay Webhook
 * Formula: HMAC_SHA256(raw_body, webhook_secret)
 */
function generateWebhookSignature(rawBody, secret = DEFAULT_WEBHOOK_SECRET) {
  const bodyString = typeof rawBody === 'string' ? rawBody : (Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : JSON.stringify(rawBody));
  return crypto
    .createHmac('sha256', secret)
    .update(bodyString)
    .digest('hex');
}

/**
 * Generates a unique test email address
 */
function generateUniqueEmail(prefix = 'testuser') {
  const rand = Math.random().toString(36).substring(2, 8);
  const time = Date.now().toString(36);
  return `${prefix}_${time}_${rand}@example.com`;
}

/**
 * Generates a unique SKU
 */
function generateUniqueSku(prefix = 'TEST-SKU') {
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${rand}`;
}

/**
 * Generates a valid Spotify track URL
 */
function generateSpotifyUrl(trackId = '4cOdK2wGLETKBW3PvgPWqT') {
  return `https://open.spotify.com/track/${trackId}`;
}

/**
 * Generates a valid Spotify URI
 */
function generateSpotifyUri(trackId = '4cOdK2wGLETKBW3PvgPWqT') {
  return `spotify:track:${trackId}`;
}

/**
 * Standard test customer payload
 */
function generateTestCustomer() {
  const rand = Math.random().toString(36).substring(2, 6);
  return {
    name: `Test Customer ${rand}`,
    email: generateUniqueEmail('customer'),
    password: 'Password123!',
    phone: '+919876543210',
    shippingAddress: {
      fullName: `Test Customer ${rand}`,
      phone: '+919876543210',
      addressLine1: '123 Test Street, Cyber Hub',
      line1: '123 Test Street, Cyber Hub',
      line2: 'Floor 4, Suite 402',
      city: 'Bengaluru',
      state: 'Karnataka',
      postalCode: '560001',
      pincode: '560001',
      country: 'India'
    }
  };
}

module.exports = {
  DEFAULT_RAZORPAY_SECRET,
  DEFAULT_WEBHOOK_SECRET,
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_ADMIN_PASSWORD,
  generateRazorpaySignature,
  generateWebhookSignature,
  generateUniqueEmail,
  generateUniqueSku,
  generateSpotifyUrl,
  generateSpotifyUri,
  generateTestCustomer
};
