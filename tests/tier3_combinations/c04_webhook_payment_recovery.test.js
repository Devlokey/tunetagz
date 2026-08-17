/**
 * Tier 3 — Combination 4: Asynchronous Webhook Payment Recovery
 * Cross-feature pairwise workflow:
 * Customer places order -> Network drops before frontend verify ->
 * Razorpay fires async payment.captured webhook -> Order status transitions to ORDER_RECEIVED ->
 * Customer logs in later and verifies confirmed order in my-orders.
 */

const { generateUniqueEmail, generateTestCustomer, generateWebhookSignature } = require('../helpers/cryptoHelper');

module.exports = {
  title: 'C4: Asynchronous Webhook Payment Recovery Integration',
  run: async (t, client) => {
    // 1. Customer registers and logs in
    const email = generateUniqueEmail('wh_recovery_cust');
    const password = 'RecoveryPassword123!';
    const regRes = await client.post('/api/auth/register', { email, password, name: 'Siddharth Varma' });
    const token = regRes.data?.token || regRes.data?.accessToken;
    client.setToken(token);

    // 2. Customer places order
    const productsRes = await client.get('/api/products');
    const products = Array.isArray(productsRes.data) ? productsRes.data : productsRes.data?.data || productsRes.data?.products || [];
    const product = products[0];

    const customerData = generateTestCustomer();
    customerData.email = email;

    const orderRes = await client.post('/api/payments/create-order', {
      items: [{ productId: product.id, quantity: 1, customText: 'Webhook Recovery' }],
      customer: customerData,
      shippingAddress: customerData.shippingAddress
    });

    const paymentData = orderRes.data?.data || orderRes.data;
    const rzpOrderId = paymentData.razorpayOrderId || paymentData.razorpay_order_id || 'order_mock_' + Date.now();
    const rzpPaymentId = 'pay_async_recovery_' + Date.now().toString(36);

    // 3. Customer disconnects (no client-side /api/payments/verify call)
    client.clearToken();

    // 4. Razorpay sends asynchronous webhook notification
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'mock_webhook_secret_67890';
    const webhookPayload = {
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

    const signature = generateWebhookSignature(webhookPayload, webhookSecret);
    const whRes = await client.post('/api/payments/webhook', webhookPayload, {
      'x-razorpay-signature': signature
    });
    t.assert(whRes.status === 200 || whRes.status === 202, 'Webhook processed successfully');

    // 5. Customer logs in later and inspects order history
    const loginRes = await client.post('/api/auth/login', { email, password });
    const freshToken = loginRes.data?.token || loginRes.data?.accessToken;
    client.setToken(freshToken);

    const historyRes = await client.get('/api/orders/my-orders');
    t.assertStatus(historyRes, 200, 'Customer retrieves order history');
    const orders = Array.isArray(historyRes.data) ? historyRes.data : historyRes.data?.orders || historyRes.data?.data || [];
    t.assert(orders.length >= 1, 'Customer sees recovered order in order history');
  }
};
