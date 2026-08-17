const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const authController = require('../controllers/auth.controller');
const upload = require('../middleware/upload');
const { authenticateToken } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/adminAuth');

// Public Admin Login endpoint
router.post('/login', authController.adminLogin);

// Protected Admin routes (require authenticateToken + requireAdmin)
router.use(authenticateToken, requireAdmin);

// Analytics & Dashboard KPIs
router.get('/stats', adminController.getStats);

// Order Management & Fulfillment
router.get('/orders', adminController.listOrders);
router.get('/orders/:id', adminController.getOrder);
router.patch('/orders/:id/status', adminController.updateOrderStatus);
router.post('/orders/:id/cancel', adminController.cancelOrder);

// Product Catalog Management
router.get('/products', adminController.listProducts);
router.post('/products', upload.single('image'), adminController.createProduct);
router.put('/products/:id', upload.single('image'), adminController.updateProduct);
router.patch('/products/:id/stock', adminController.toggleStock);
router.delete('/products/:id', adminController.deleteProduct);

// Store Settings & Audit Trail
router.get('/settings', adminController.getSettings);
router.put('/settings', adminController.updateSettings);
router.get('/audit-logs', adminController.getAuditLogs);

module.exports = router;
