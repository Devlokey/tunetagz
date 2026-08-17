const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const { optionalAuth } = require('../middleware/auth');

// Create payment gateway order
router.post('/create-order', optionalAuth, paymentController.createPaymentOrder);

// Verify payment signature
router.post('/verify', paymentController.verifyPayment);

// Webhook endpoint
router.post('/webhook', paymentController.handleWebhook);

module.exports = router;
