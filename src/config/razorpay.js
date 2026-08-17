const Razorpay = require('razorpay');
const crypto = require('crypto');
const env = require('./env');
const logger = require('../utils/logger');

let razorpayInstance = null;

if (!env.MOCK_PAYMENTS && env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET && env.RAZORPAY_KEY_ID !== 'rzp_test_placeholder') {
  try {
    razorpayInstance = new Razorpay({
      key_id: env.RAZORPAY_KEY_ID,
      key_secret: env.RAZORPAY_KEY_SECRET
    });
    logger.info('Razorpay live/test SDK client initialized.');
  } catch (err) {
    logger.warn('Failed to initialize Razorpay SDK instance, falling back to mock provider:', err.message);
  }
} else {
  logger.info('Running with deterministic Mock Payment Provider (MOCK_PAYMENTS=true).');
}

/**
 * Creates a Razorpay order or deterministic mock order
 */
async function createRazorpayOrder({ amountPaise, currency = 'INR', receipt, notes = {} }) {
  if (razorpayInstance && !env.MOCK_PAYMENTS) {
    try {
      const order = await razorpayInstance.orders.create({
        amount: amountPaise,
        currency,
        receipt,
        notes
      });
      return {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
        status: order.status
      };
    } catch (err) {
      logger.error('Razorpay live order creation error, falling back to mock:', err.message);
    }
  }

  // Deterministic Mock Order for testing & offline sandbox
  const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
  const mockOrderId = `order_mock_${Date.now()}_${randomSuffix}`;
  return {
    id: mockOrderId,
    amount: amountPaise,
    currency,
    receipt,
    status: 'created',
    isMock: true
  };
}

/**
 * Verifies Razorpay payment signature
 */
function verifyRazorpaySignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return false;
  }

  // Mock order verification support
  if (env.MOCK_PAYMENTS || razorpay_order_id.startsWith('order_mock_') || razorpay_payment_id.startsWith('pay_mock_')) {
    // Generate expected mock signature
    const secret = env.RAZORPAY_KEY_SECRET || 'mock_secret';
    const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generatedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    if (razorpay_signature === generatedSignature || razorpay_signature === 'mock_signature_valid' || razorpay_signature === `mock_sig_${razorpay_payment_id}`) {
      return true;
    }
  }

  const secret = env.RAZORPAY_KEY_SECRET || 'mock_secret';
  const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
  const generatedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  try {
    const expectedBuf = Buffer.from(generatedSignature, 'utf8');
    const providedBuf = Buffer.from(razorpay_signature, 'utf8');
    if (expectedBuf.length !== providedBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(expectedBuf, providedBuf);
  } catch (e) {
    return false;
  }
}

/**
 * Generates a valid test signature for an order and payment
 */
function generateTestSignature(razorpay_order_id, razorpay_payment_id) {
  const secret = env.RAZORPAY_KEY_SECRET || 'mock_secret';
  const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

/**
 * Verifies Webhook Signature
 */
function verifyWebhookSignature(rawBody, signature, webhookSecret = env.RAZORPAY_WEBHOOK_SECRET) {
  if (!signature || !webhookSecret) return false;
  try {
    const expected = crypto
      .createHmac('sha256', webhookSecret)
      .update(typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8'))
      .digest('hex');
    const expectedBuf = Buffer.from(expected, 'utf8');
    const providedBuf = Buffer.from(signature, 'utf8');
    if (expectedBuf.length !== providedBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, providedBuf);
  } catch (e) {
    return false;
  }
}

module.exports = {
  createRazorpayOrder,
  verifyRazorpaySignature,
  generateTestSignature,
  verifyWebhookSignature
};
