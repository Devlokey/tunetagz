const productService = require('../services/product.service');

async function listProducts(req, res, next) {
  try {
    const inStockOnly = req.query.inStock === 'true' || req.query.in_stock === 'true';
    const category = req.query.category || null;
    const includeInactive = req.query.all === 'true' && req.user && (req.user.role === 'admin' || req.user.role === 'developer');

    const products = await productService.getAllProducts({ inStockOnly, category, includeInactive });

    return res.status(200).json({
      success: true,
      data: products,
      products: products
    });
  } catch (err) {
    next(err);
  }
}

async function getProduct(req, res, next) {
  try {
    const { id } = req.params;
    const product = await productService.getProductById(id);

    return res.status(200).json({
      success: true,
      data: product,
      product: product
    });
  } catch (err) {
    next(err);
  }
}

async function uploadProductImage(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file provided in multipart upload (field name must be "image" or "file").'
      });
    }

    const relativePath = `/uploads/${req.file.filename}`;
    return res.status(201).json({
      success: true,
      imageUrl: relativePath,
      image_url: relativePath,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  } catch (err) {
    next(err);
  }
}

async function createProduct(req, res, next) {
  try {
    const data = { ...req.body };

    // If file uploaded in same request
    if (req.file) {
      data.imageUrl = `/uploads/${req.file.filename}`;
    }

    const adminUserId = req.user ? req.user.id : null;
    const product = await productService.createProduct(data, adminUserId);

    return res.status(201).json({
      success: true,
      product,
      data: product
    });
  } catch (err) {
    next(err);
  }
}

async function updateProduct(req, res, next) {
  try {
    const { id } = req.params;
    const data = { ...req.body };

    if (req.file) {
      data.imageUrl = `/uploads/${req.file.filename}`;
    }

    const adminUserId = req.user ? req.user.id : null;
    const product = await productService.updateProduct(Number(id), data, adminUserId);

    return res.status(200).json({
      success: true,
      product,
      data: product
    });
  } catch (err) {
    next(err);
  }
}

async function toggleStock(req, res, next) {
  try {
    const { id } = req.params;
    const inStock = req.body.inStock !== undefined ? Boolean(req.body.inStock) : Boolean(req.body.in_stock);
    const adminUserId = req.user ? req.user.id : null;

    const product = await productService.toggleProductStock(Number(id), inStock, adminUserId);

    return res.status(200).json({
      success: true,
      id: product.id,
      inStock: product.inStock,
      in_stock: product.in_stock,
      product
    });
  } catch (err) {
    next(err);
  }
}

async function deleteProduct(req, res, next) {
  try {
    const { id } = req.params;
    const adminUserId = req.user ? req.user.id : null;
    const result = await productService.deleteProduct(Number(id), adminUserId);

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listProducts,
  getProduct,
  uploadProductImage,
  createProduct,
  updateProduct,
  toggleStock,
  deleteProduct
};
