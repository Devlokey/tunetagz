const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticateToken } = require('../middleware/auth');

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/google', authController.googleAuth);
router.post('/admin/login', authController.adminLogin);
router.post('/admin-login', authController.adminLogin); // alias for convenience
router.post('/logout', authController.logout);

// Authenticated routes
router.get('/me', authenticateToken, authController.getMe);

module.exports = router;
