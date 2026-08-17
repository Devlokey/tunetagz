const { getDb } = require('../config/database');
const { createRazorpayOrder, verifyRazorpaySignature, verifyWebhookSignature } = require('../config/razorpay');
const orderService = require('./order.service');
const env = require('../config/env');
const logger = require('../utils/logger');

/**
 * Creates a Razorpay gateway order for an internal order
 */
async function initiatePayment(payload, userId = null) {
  const db = getDb();
  let order = null;

  const orderId = payload.orderId || payload.order_id || payload.id;
  const orderNumber = payload.orderNumber || payload.order_number;

  if (orderId || orderNumber) {
    const rawOrder = db.prepare('SELECT * FROM orders WHERE id = ? OR order_number = ?').get(orderId || 0, orderNumber || '');
    if (!rawOrder) {
      const error = new Error(`Order '${orderId || orderNumber}' not found.`);
      error.status = 404;
      throw error;
    }
    order = rawOrder;
  } else if (payload.items) {
    // Create new order on the fly
    const created = await orderService.createOrder(payload, userId);
    order = db.prepare('SELECT * FROM orders WHERE id = ?').get(created.id);
  } else {
    const error = new Error('Order ID or order items are required to create a payment order.');
    error.status = 400;
    throw error;
  }

  if (order.payment_status === 'PAID' || order.status === 'ORDER_RECEIVED' || order.status === 'DELIVERED') {
    const error = new Error('This order has already been paid for.');
    error.status = 409;
    throw error;
  }

  if (order.status === 'CANCELLED') {
    const error = new Error('This order has been cancelled.');
    error.status = 400;
    throw error;
  }

  const amountPaise = Math.round(Number(order.total_amount) * 100);

  const rzpOrder = await createRazorpayOrder({
    amountPaise,
    currency: order.currency || 'INR',
    receipt: order.order_number,
    notes: {
      orderId: order.id,
      orderNumber: order.order_number,
      customerEmail: order.customer_email
    }
  });

  // Update order with razorpay_order_id
  db.prepare(`
    UPDATE orders SET
      razorpay_order_id = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(rzpOrder.id, order.id);

  // Insert or update payment record
  const existingPayment = db.prepare('SELECT id FROM payments WHERE order_id = ? AND razorpay_order_id = ?').get(order.id, rzpOrder.id);
  if (!existingPayment) {
    db.prepare(`
      INSERT INTO payments (order_id, razorpay_order_id, amount, currency, status)
      VALUES (?, ?, ?, ?, 'CREATED')
    `).run(order.id, rzpOrder.id, Number(order.total_amount), order.currency || 'INR');
  }

  logger.info(`Razorpay order created: ${rzpOrder.id} for Order ${order.order_number} (₹${order.total_amount})`);

  return {
    success: true,
    orderId: order.id,
    orderNumber: order.order_number,
    razorpayOrderId: rzpOrder.id,
    razorpay_order_id: rzpOrder.id,
    amount: amountPaise,
    amountPaise: amountPaise,
    totalAmount: Number(order.total_amount),
    currency: order.currency || 'INR',
    keyId: env.RAZORPAY_KEY_ID,
    customer: {
      name: order.customer_name,
      email: order.customer_email,
      phone: order.customer_phone
    }
  };
}

/**
 * Cryptographically verifies Razorpay payment signature and updates order status
 */
async function verifyPaymentSignatureAndConfirm(verificationData) {
  const db = getDb();

  const razorpayOrderId = verificationData.razorpay_order_id || verificationData.razorpayOrderId;
  const razorpayPaymentId = verificationData.razorpay_payment_id || verificationData.razorpayPaymentId;
  const razorpaySignature = verificationData.razorpay_signature || verificationData.razorpaySignature;
  const orderId = verificationData.orderId || verificationData.order_id;

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    const error = new Error('razorpay_order_id, razorpay_payment_id, and razorpay_signature are all required for verification.');
    error.status = 400;
    throw error;
  }

  // Find order record
  let order = null;
  if (orderId) {
    order = db.prepare('SELECT * FROM orders WHERE id = ? OR razorpay_order_id = ?').get(orderId, razorpayOrderId);
  } else {
    order = db.prepare('SELECT * FROM orders WHERE razorpay_order_id = ?').get(razorpayOrderId);
  }

  if (!order) {
    const error = new Error(`Order corresponding to Razorpay Order '${razorpayOrderId}' not found.`);
    error.status = 404;
    throw error;
  }

  // Perform cryptographic signature verification
  const isValid = verifyRazorpaySignature({
    razorpay_order_id: razorpayOrderId,
    razorpay_payment_id: razorpayPaymentId,
    razorpay_signature: razorpaySignature
  });

  if (!isValid) {
    logger.warn(`Payment signature verification failed for Order ${order.order_number}, rzpOrder: ${razorpayOrderId}`);
    const error = new Error('Invalid payment signature. Verification failed.');
    error.status = 400;
    throw error;
  }

  // Check idempotency: if already paid, return confirmed response without duplicate side effects
  if (order.payment_status === 'PAID' && order.status !== 'PENDING_PAYMENT') {
    logger.info(`Order ${order.order_number} already marked PAID (idempotent verification).`);
    return {
      success: true,
      message: 'Payment already verified and confirmed',
      orderId: order.id,
      orderNumber: order.order_number,
      status: order.status,
      paymentId: razorpayPaymentId,
      order: {
        id: order.id,
        orderNumber: order.order_number,
        status: order.status
      }
    };
  }

  // Update DB state
  db.transaction(() => {
    // 1. Update order
    db.prepare(`
      UPDATE orders SET
        status = 'ORDER_RECEIVED',
        payment_status = 'PAID',
        razorpay_payment_id = ?,
        paid_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(razorpayPaymentId, order.id);

    // 2. Update payment
    const payment = db.prepare('SELECT id FROM payments WHERE razorpay_order_id = ?').get(razorpayOrderId);
    if (payment) {
      db.prepare(`
        UPDATE payments SET
          status = 'CAPTURED',
          razorpay_payment_id = ?,
          razorpay_signature = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(razorpayPaymentId, razorpaySignature, payment.id);
    } else {
      db.prepare(`
        INSERT INTO payments (order_id, razorpay_order_id, razorpay_payment_id, razorpay_signature, amount, currency, status)
        VALUES (?, ?, ?, ?, ?, 'INR', 'CAPTURED')
      `).run(order.id, razorpayOrderId, razorpayPaymentId, razorpaySignature, Number(order.total_amount));
    }
  })();

  logger.info(`Payment verified successfully! Order ${order.order_number} transitioned to ORDER_RECEIVED. Payment ID: ${razorpayPaymentId}`);

  return {
    success: true,
    message: 'Payment verified and order confirmed successfully',
    orderId: order.id,
    orderNumber: order.order_number,
    status: 'ORDER_RECEIVED',
    paymentId: razorpayPaymentId,
    order: {
      id: order.id,
      orderNumber: order.order_number,
      status: 'ORDER_RECEIVED'
    }
  };
}

/**
 * Handles incoming asynchronous Razorpay Webhook events
 */
async function processWebhook(rawBody, signature) {
  const db = getDb();

  // Validate webhook signature if secret configured
  if (env.RAZORPAY_WEBHOOK_SECRET && !env.MOCK_PAYMENTS) {
    const isSigValid = verifyWebhookSignature(rawBody, signature, env.RAZORPAY_WEBHOOK_SECRET);
    if (!isSigValid) {
      const error = new Error('Invalid Razorpay webhook signature.');
      error.status = 400;
      throw error;
    }
  }

  let event = null;
  try {
    event = typeof rawBody === 'string' ? JSON.parse(rawBody) : JSON.parse(rawBody.toString('utf8'));
  } catch (parseErr) {
    const error = new Error('Malformed webhook JSON payload.');
    error.status = 400;
    throw error;
  }

  const eventName = event.event;
  logger.info(`Processing Razorpay Webhook Event: ${eventName}`);

  if (eventName === 'payment.captured' || eventName === 'order.paid') {
    const paymentEntity = event.payload?.payment?.entity || {};
    const rzpOrderId = paymentEntity.order_id || event.payload?.order?.entity?.id;
    const rzpPaymentId = paymentEntity.id;
    const method = paymentEntity.method;

    if (rzpOrderId) {
      const order = db.prepare('SELECT * FROM orders WHERE razorpay_order_id = ?').get(rzpOrderId);
      if (order && order.status === 'PENDING_PAYMENT') {
        db.prepare(`
          UPDATE orders SET
            status = 'ORDER_RECEIVED',
            payment_status = 'PAID',
            razorpay_payment_id = ?,
            paid_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(rzpPaymentId || order.razorpay_payment_id, order.id);

        db.prepare(`
          UPDATE payments SET
            status = 'CAPTURED',
            razorpay_payment_id = COALESCE(?, razorpay_payment_id),
            method = ?,
            raw_webhook_payload = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE razorpay_order_id = ?
        `).run(rzpPaymentId, method, JSON.stringify(event), rzpOrderId);

        logger.info(`Webhook captured payment for order ${order.order_number}`);
      }
    }
  } else if (eventName === 'payment.failed') {
    const paymentEntity = event.payload?.payment?.entity || {};
    const rzpOrderId = paymentEntity.order_id;
    const errorCode = paymentEntity.error_code;
    const errorDesc = paymentEntity.error_description;

    if (rzpOrderId) {
      db.prepare(`
        UPDATE payments SET
          status = 'FAILED',
          error_code = ?,
          error_description = ?,
          raw_webhook_payload = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE razorpay_order_id = ?
      `).run(errorCode, errorDesc, JSON.stringify(event), rzpOrderId);
    }
  }

  return {
    status: 'ok',
    event: eventName,
    processed: true
  };
}

module.exports = {
  initiatePayment,
  verifyPaymentSignatureAndConfirm,
  processWebhook
};
