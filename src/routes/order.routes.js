const express = require('express');
const router = express.Router();
const orderController = require('../controllers/order.controller');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

// Public / Guest & Authenticated Ordering
router.post('/calculate', orderController.calculateTotal);
router.post('/', optionalAuth, orderController.createOrder);

// Tracking endpoints (Public & Authenticated)
router.get('/track', orderController.trackOrder);
router.get('/:orderId/track', orderController.trackOrder);

// Authenticated customer order history
router.get('/my-orders', authenticateToken, orderController.getMyOrders);

// Single order details
router.get('/:orderId', optionalAuth, orderController.getOrderById);

module.exports = router;
