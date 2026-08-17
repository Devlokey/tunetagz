const orderService = require('../services/order.service');

async function createOrder(req, res, next) {
  try {
    const userId = req.user ? req.user.id : null;
    const order = await orderService.createOrder(req.body, userId);

    return res.status(201).json({
      success: true,
      order,
      orderId: order.id,
      orderNumber: order.orderNumber
    });
  } catch (err) {
    next(err);
  }
}

async function calculateTotal(req, res, next) {
  try {
    const items = req.body.items || [];
    const calculation = await orderService.calculateOrderTotal(items);

    return res.status(200).json({
      success: true,
      ...calculation
    });
  } catch (err) {
    next(err);
  }
}

async function getMyOrders(req, res, next) {
  try {
    const userId = req.user.id;
    const email = req.user.email;
    const orders = await orderService.getUserOrders(userId, email);

    return res.status(200).json({
      success: true,
      data: orders,
      orders: orders
    });
  } catch (err) {
    next(err);
  }
}

async function trackOrder(req, res, next) {
  try {
    const idOrNumber = req.params.orderId || req.query.orderNumber || req.query.orderId || req.query.id;

    if (!idOrNumber) {
      return res.status(400).json({
        success: false,
        error: 'Order ID or order number is required for tracking.'
      });
    }

    const verification = req.query.email || req.query.phone || null;
    const tracking = await orderService.getOrderTracking(idOrNumber, verification);

    return res.status(200).json({
      success: true,
      order: tracking,
      tracking
    });
  } catch (err) {
    next(err);
  }
}

async function getOrderById(req, res, next) {
  try {
    const idOrNumber = req.params.orderId || req.params.id;
    const order = await orderService.getOrderDetails(idOrNumber);

    // If customer, verify ownership
    if (req.user && req.user.role !== 'admin' && req.user.role !== 'developer') {
      if (order.userId && order.userId !== req.user.id && order.customerEmail.toLowerCase() !== req.user.email.toLowerCase()) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: You do not have permission to view this order.'
        });
      }
    }

    return res.status(200).json({
      success: true,
      order,
      data: order
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createOrder,
  calculateTotal,
  getMyOrders,
  trackOrder,
  getOrderById
};
