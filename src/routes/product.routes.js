const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');
const upload = require('../middleware/upload');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/adminAuth');

// Public catalog routes
router.get('/', optionalAuth, productController.listProducts);
router.get('/:id', productController.getProduct);

// Admin-protected image upload
router.post(
  '/upload',
  authenticateToken,
  requireAdmin,
  (req, res, next) => {
    upload.single('image')(req, res, (err) => {
      if (err) return next(err);
      // Fallback field name 'file' if 'image' was empty
      if (!req.file) {
        upload.single('file')(req, res, next);
      } else {
        next();
      }
    });
  },
  productController.uploadProductImage
);

// Admin-protected product CRUD
router.post('/', authenticateToken, requireAdmin, upload.single('image'), productController.createProduct);
router.put('/:id', authenticateToken, requireAdmin, upload.single('image'), productController.updateProduct);
router.patch('/:id/stock', authenticateToken, requireAdmin, productController.toggleStock);
router.delete('/:id', authenticateToken, requireAdmin, productController.deleteProduct);

module.exports = router;
