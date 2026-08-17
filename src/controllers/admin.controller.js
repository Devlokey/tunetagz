const adminService = require('../services/admin.service');
const productService = require('../services/product.service');
const orderService = require('../services/order.service');

async function getStats(req, res, next) {
  try {
    const stats = await adminService.getAdminStats();
    return res.status(200).json({
      success: true,
      stats,
      ...stats
    });
  } catch (err) {
    next(err);
  }
}

async function listOrders(req, res, next) {
  try {
    const { status, search, page, limit } = req.query;
    const result = await adminService.listOrders({ status, search, page, limit });

    return res.status(200).json({
      success: true,
      orders: result.orders,
      data: result.orders,
      pagination: result.pagination
    });
  } catch (err) {
    next(err);
  }
}

async function getOrder(req, res, next) {
  try {
    const { id } = req.params;
    const order = await orderService.getOrderDetails(id);

    return res.status(200).json({
      success: true,
      order,
      data: order
    });
  } catch (err) {
    next(err);
  }
}

async function updateOrderStatus(req, res, next) {
  try {
    const { id } = req.params;
    const adminUserId = req.user ? req.user.id : null;
    const updatedOrder = await adminService.updateOrderStatus(id, req.body, adminUserId);

    return res.status(200).json({
      success: true,
      message: 'Order status updated successfully',
      order: updatedOrder,
      id: updatedOrder.id,
      orderNumber: updatedOrder.orderNumber,
      status: updatedOrder.status,
      courierName: updatedOrder.courierName,
      trackingNumber: updatedOrder.trackingNumber,
      updatedAt: updatedOrder.updatedAt
    });
  } catch (err) {
    next(err);
  }
}

async function cancelOrder(req, res, next) {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const adminUserId = req.user ? req.user.id : null;
    const cancelledOrder = await adminService.cancelOrder(id, reason, adminUserId);

    return res.status(200).json({
      success: true,
      message: 'Order cancelled',
      order: cancelledOrder
    });
  } catch (err) {
    next(err);
  }
}

async function listProducts(req, res, next) {
  try {
    const products = await productService.getAllProducts({ includeInactive: true });
    return res.status(200).json({
      success: true,
      products,
      data: products
    });
  } catch (err) {
    next(err);
  }
}

async function createProduct(req, res, next) {
  try {
    const data = { ...req.body };
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

async function getSettings(req, res, next) {
  try {
    const settings = await adminService.getStoreSettings();
    return res.status(200).json({
      success: true,
      settings
    });
  } catch (err) {
    next(err);
  }
}

async function updateSettings(req, res, next) {
  try {
    const adminUserId = req.user ? req.user.id : null;
    const settings = await adminService.updateStoreSettings(req.body, adminUserId);
    return res.status(200).json({
      success: true,
      message: 'Store settings updated successfully',
      settings
    });
  } catch (err) {
    next(err);
  }
}

async function getAuditLogs(req, res, next) {
  try {
    const limit = parseInt(req.query.limit || '50', 10);
    const logs = await adminService.getAuditLogs(limit);
    return res.status(200).json({
      success: true,
      logs
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getStats,
  listOrders,
  getOrder,
  updateOrderStatus,
  cancelOrder,
  listProducts,
  createProduct,
  updateProduct,
  toggleStock,
  deleteProduct,
  getSettings,
  updateSettings,
  getAuditLogs
};
