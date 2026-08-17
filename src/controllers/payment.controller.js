const paymentService = require('../services/payment.service');

async function createPaymentOrder(req, res, next) {
  try {
    const userId = req.user ? req.user.id : null;
    const paymentData = await paymentService.initiatePayment(req.body, userId);

    return res.status(201).json(paymentData);
  } catch (err) {
    next(err);
  }
}

async function verifyPayment(req, res, next) {
  try {
    const result = await paymentService.verifyPaymentSignatureAndConfirm(req.body);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function handleWebhook(req, res, next) {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const rawBody = req.rawBody || req.body;
    const result = await paymentService.processWebhook(rawBody, signature);

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createPaymentOrder,
  verifyPayment,
  handleWebhook
};
