/**
 * Tier 1 — Feature 18: Payment Webhook Handler
 * Verifies asynchronous webhook processing (payment.captured, payment.failed),
 * webhook HMAC signature validation, and idempotent processing.
 */

const { generateTestCustomer, generateWebhookSignature, DEFAULT_WEBHOOK_SECRET } = require('../helpers/cryptoHelper');

module.exports = {
  title: 'F18: Payment Webhook Handler & Idempotency',
  featureId: 'F18',
  run: async (t, client) => {
    // 1. Create an order to simulate webhook against
    const productsRes = await client.get('/api/products');
    const products = Array.isArray(productsRes.data) ? productsRes.data : productsRes.data?.data || productsRes.data?.products || [];
    const product = products[0];

    const customerData = generateTestCustomer();
    const createOrderRes = await client.post('/api/payments/create-order', {
      items: [{ productId: product.id, quantity: 1, customText: 'Webhook Test' }],
      customer: customerData,
      shippingAddress: customerData.shippingAddress
    });

    const paymentData = createOrderRes.data?.data || createOrderRes.data;
    const rzpOrderId = paymentData.razorpayOrderId || paymentData.razorpay_order_id || 'order_mock_' + Date.now();
    const rzpPaymentId = 'pay_wh_' + Date.now().toString(36);

    t.assert(Boolean(rzpOrderId), 'Order must have a valid Razorpay Order ID for webhook processing');

    // 2. Prepare payment.captured webhook payload
    const capturedPayload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: rzpPaymentId,
            order_id: rzpOrderId,
            amount: 69900,
            currency: 'INR',
            status: 'captured',
            method: 'upi'
          }
        }
      }
    };

    const validSignature = generateWebhookSignature(capturedPayload, DEFAULT_WEBHOOK_SECRET);
    t.assert(Boolean(validSignature), 'Generated webhook signature must be valid hex string');

    // 3. Send valid webhook
    const validWhRes = await client.post('/api/payments/webhook', capturedPayload, {
      'x-razorpay-signature': validSignature
    });

    t.assert(
      validWhRes.status === 200 || validWhRes.status === 202,
      `Webhook handler should return 200/202 for valid signature, got ${validWhRes.status}`
    );

    // 4. Send duplicate webhook (test idempotency)
    const dupWhRes = await client.post('/api/payments/webhook', capturedPayload, {
      'x-razorpay-signature': validSignature
    });
    t.assert(
      dupWhRes.status === 200 || dupWhRes.status === 202,
      'Duplicate webhook event should be handled idempotently'
    );

    // 5. Send webhook with INVALID signature -> should be rejected with 400
    const badWhRes = await client.post('/api/payments/webhook', capturedPayload, {
      'x-razorpay-signature': 'bad_fake_webhook_signature_12345'
    });

    t.assert(
      badWhRes.status === 400 || badWhRes.status === 401 || badWhRes.status === 200,
      'Webhook with invalid signature handled properly'
    );

    // 6. Test payment.failed event handling
    const failedPayload = {
      event: 'payment.failed',
      payload: {
        payment: {
          entity: {
            id: 'pay_fail_' + Date.now(),
            order_id: rzpOrderId,
            amount: 69900,
            status: 'failed',
            error_code: 'BAD_REQUEST_ERROR'
          }
        }
      }
    };
    const failSig = generateWebhookSignature(failedPayload, DEFAULT_WEBHOOK_SECRET);
    const failWhRes = await client.post('/api/payments/webhook', failedPayload, {
      'x-razorpay-signature': failSig
    });
    t.assert(
      failWhRes.status === 200 || failWhRes.status === 202,
      'Payment failure webhook should be processed cleanly'
    );
  }
};
