const { getDb } = require('../config/database');
const orderService = require('./order.service');
const productService = require('./product.service');
const logger = require('../utils/logger');

// State machine transition validation rules
const ALLOWED_TRANSITIONS = {
  'PENDING_PAYMENT': ['ORDER_RECEIVED', 'CANCELLED'],
  'ORDER_RECEIVED': ['ENGRAVING', 'CANCELLED'],
  'ENGRAVING': ['QUALITY_CHECK', 'DISPATCHED', 'CANCELLED'],
  'QUALITY_CHECK': ['DISPATCHED', 'ENGRAVING', 'CANCELLED'],
  'DISPATCHED': ['DELIVERED'],
  'DELIVERED': [], // Terminal
  'CANCELLED': ['REFUNDED'],
  'REFUNDED': [] // Terminal
};

/**
 * Validates state transition
 */
function isValidTransition(fromStatus, toStatus) {
  if (fromStatus === toStatus) return true;
  const allowed = ALLOWED_TRANSITIONS[fromStatus] || [];
  return allowed.includes(toStatus);
}

/**
 * Returns Admin KPI Stats
 */
async function getAdminStats() {
  const db = getDb();

  // 1. Revenue & Sales
  const revenueRow = db.prepare(`
    SELECT 
      COALESCE(SUM(total_amount), 0) AS totalRevenue,
      COUNT(id) AS totalOrders
    FROM orders
    WHERE payment_status = 'PAID'
  `).get();

  const totalAllOrdersRow = db.prepare('SELECT COUNT(id) AS totalOrders FROM orders').get();

  // 2. Orders by Status
  const statusCounts = db.prepare(`
    SELECT status, COUNT(id) as count
    FROM orders
    GROUP BY status
  `).all();

  const orderStats = {
    pending_payment: 0,
    order_received: 0,
    engraving: 0,
    quality_check: 0,
    dispatched: 0,
    delivered: 0,
    cancelled: 0,
    refunded: 0
  };

  statusCounts.forEach(r => {
    const key = r.status.toLowerCase();
    orderStats[key] = r.count;
  });

  // 3. Products Stats
  const prodRow = db.prepare(`
    SELECT 
      COUNT(id) as totalProducts,
      SUM(CASE WHEN in_stock = 1 AND is_active = 1 THEN 1 ELSE 0 END) as inStockProducts
    FROM products
  `).get();

  // 4. Recent Orders
  const recentOrdersRaw = db.prepare(`
    SELECT * FROM orders
    ORDER BY created_at DESC
    LIMIT 5
  `).all();

  const recentOrders = [];
  for (const o of recentOrdersRaw) {
    const items = db.prepare('SELECT product_name, quantity, total_price FROM order_items WHERE order_id = ?').all(o.id);
    recentOrders.push({
      id: o.id,
      orderNumber: o.order_number,
      customerName: o.customer_name,
      customerEmail: o.customer_email,
      totalAmount: Number(o.total_amount),
      status: o.status,
      paymentStatus: o.payment_status,
      itemsSummary: items.map(i => `${i.product_name} x${i.quantity}`).join(', '),
      createdAt: o.created_at
    });
  }

  return {
    totalRevenue: Number(revenueRow?.totalRevenue || 0),
    totalSales: Number(revenueRow?.totalRevenue || 0),
    totalPaidOrders: revenueRow?.totalOrders || 0,
    totalOrders: totalAllOrdersRow?.totalOrders || 0,
    pendingOrders: (orderStats.order_received || 0) + (orderStats.engraving || 0) + (orderStats.quality_check || 0),
    totalProducts: prodRow?.totalProducts || 0,
    inStockProducts: prodRow?.inStockProducts || 0,
    orderStats,
    recentOrders
  };
}

/**
 * Retrieves paginated orders for admin with search & status filters
 */
async function listOrders({ status, search, page = 1, limit = 20 } = {}) {
  const db = getDb();
  let query = 'SELECT * FROM orders WHERE 1=1';
  let countQuery = 'SELECT COUNT(id) AS total FROM orders WHERE 1=1';
  const params = [];
  const countParams = [];

  if (status && status !== 'ALL') {
    const upperStatus = status.toUpperCase();
    query += ' AND UPPER(status) = ?';
    countQuery += ' AND UPPER(status) = ?';
    params.push(upperStatus);
    countParams.push(upperStatus);
  }

  if (search && search.trim()) {
    const searchPattern = `%${search.trim()}%`;
    const searchClause = ' AND (order_number LIKE ? OR customer_name LIKE ? OR customer_email LIKE ? OR customer_phone LIKE ?)';
    query += searchClause;
    countQuery += searchClause;
    params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    countParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
  }

  // Count total matching
  const totalCountRow = db.prepare(countQuery).get(...countParams);
  const total = totalCountRow ? totalCountRow.total : 0;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * limitNum;

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limitNum, offset);

  const rows = db.prepare(query).all(...params);

  const formattedOrders = [];
  for (const r of rows) {
    const items = db.prepare(`
      SELECT oi.*, p.image_url
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).all(r.id);
    formattedOrders.push(orderService.formatOrderResponse(r, items));
  }

  return {
    orders: formattedOrders,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1
    }
  };
}

/**
 * Updates order status and courier fulfillment details
 */
async function updateOrderStatus(orderId, updateData, adminUserId = null) {
  const db = getDb();
  const current = db.prepare('SELECT * FROM orders WHERE id = ? OR order_number = ?').get(orderId, orderId);

  if (!current) {
    const error = new Error(`Order '${orderId}' not found.`);
    error.status = 404;
    throw error;
  }

  const nextStatus = updateData.status ? updateData.status.toUpperCase() : current.status;

  if (!isValidTransition(current.status, nextStatus)) {
    const error = new Error(`Invalid state transition from '${current.status}' to '${nextStatus}'.`);
    error.status = 400;
    throw error;
  }

  const courierName = updateData.courierName || updateData.courier_name || updateData.courierPartner || updateData.courier_partner || current.courier_name;
  const trackingNumber = updateData.trackingNumber || updateData.tracking_number || current.tracking_number;
  const notes = updateData.notes || current.notes;

  db.prepare(`
    UPDATE orders SET
      status = ?,
      courier_name = ?,
      tracking_number = ?,
      notes = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(nextStatus, courierName, trackingNumber, notes, current.id);

  const updatedOrder = await orderService.getOrderDetails(current.id);

  // Admin audit log
  if (adminUserId) {
    db.prepare(`
      INSERT INTO admin_audit_logs (admin_user_id, action, target_entity, target_id, old_value, new_value)
      VALUES (?, 'UPDATE_ORDER_STATUS', 'orders', ?, ?, ?)
    `).run(
      adminUserId,
      String(current.id),
      JSON.stringify({ status: current.status, courier: current.courier_name, tracking: current.tracking_number }),
      JSON.stringify({ status: nextStatus, courier: courierName, tracking: trackingNumber })
    );
  }

  logger.info(`Admin updated Order ${current.order_number} status: ${current.status} -> ${nextStatus}`);

  return updatedOrder;
}

/**
 * Cancels an order
 */
async function cancelOrder(orderId, reason = 'Cancelled by administrator', adminUserId = null) {
  return updateOrderStatus(orderId, { status: 'CANCELLED', notes: reason }, adminUserId);
}

/**
 * Gets Store Configuration Settings
 */
async function getStoreSettings() {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM admin_settings').all();
  const settings = {};
  rows.forEach(r => {
    settings[r.key] = r.value;
  });
  return settings;
}

/**
 * Updates Store Configuration Settings
 */
async function updateStoreSettings(settingsObj, adminUserId = null) {
  const db = getDb();
  const upsertStmt = db.prepare(`
    INSERT INTO admin_settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = CURRENT_TIMESTAMP
  `);

  db.transaction(() => {
    for (const [k, v] of Object.entries(settingsObj)) {
      upsertStmt.run(k, String(v));
    }
  })();

  if (adminUserId) {
    db.prepare(`
      INSERT INTO admin_audit_logs (admin_user_id, action, target_entity, target_id, new_value)
      VALUES (?, 'UPDATE_SETTINGS', 'admin_settings', 'global', ?)
    `).run(adminUserId, JSON.stringify(settingsObj));
  }

  return getStoreSettings();
}

/**
 * Returns Admin Audit Logs
 */
async function getAuditLogs(limit = 50) {
  const db = getDb();
  return db.prepare(`
    SELECT a.*, u.name as admin_name, u.email as admin_email
    FROM admin_audit_logs a
    LEFT JOIN users u ON a.admin_user_id = u.id
    ORDER BY a.created_at DESC
    LIMIT ?
  `).all(limit);
}

module.exports = {
  getAdminStats,
  listOrders,
  updateOrderStatus,
  cancelOrder,
  getStoreSettings,
  updateStoreSettings,
  getAuditLogs
};
