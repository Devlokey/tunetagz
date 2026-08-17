const { getDb } = require('../config/database');
const { parseSpotifyUrl, validateCustomText } = require('./spotify.service');
const { isValidEmail, isValidPhone, isValidPostalCode, sanitizeText } = require('../middleware/validator');
const logger = require('../utils/logger');

/**
 * Generates a unique order number (e.g. TTZ-20260817-A8F2)
 */
function generateOrderNumber() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `TTZ-${dateStr}-${randomHex}`;
}

/**
 * Calculates order totals server-side strictly from database product prices
 */
async function calculateOrderTotal(items) {
  const db = getDb();
  if (!items || !Array.isArray(items) || items.length === 0) {
    const error = new Error('Order must contain at least one item.');
    error.status = 400;
    throw error;
  }

  let subtotal = 0;
  const processedItems = [];

  for (const item of items) {
    const productId = item.productId || item.product_id || item.id;
    const quantity = parseInt(item.quantity !== undefined && item.quantity !== null ? item.quantity : 1, 10);

    if (!productId) {
      const error = new Error('Product ID is required for each item.');
      error.status = 400;
      throw error;
    }

    if (isNaN(quantity) || quantity < 1) {
      const error = new Error(`Invalid quantity (${quantity}) for product ID ${productId}. Must be at least 1.`);
      error.status = 400;
      throw error;
    }

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(productId));
    if (!product || !product.is_active) {
      const error = new Error(`Product with ID ${productId} not found or is inactive.`);
      error.status = 404;
      throw error;
    }

    if (product.coming_soon) {
      const error = new Error(`Product '${product.name}' is coming soon and cannot be ordered yet.`);
      error.status = 400;
      throw error;
    }

    if (!product.in_stock) {
      const error = new Error(`Product '${product.name}' is currently out of stock.`);
      error.status = 409;
      throw error;
    }

    // Customization processing
    const customization = item.customization || {};
    const rawSpotifyUrl = item.spotifyUrl || item.spotify_url || customization.spotifyUrl || customization.spotify_url || null;
    const rawCustomText = item.customText || item.custom_text || customization.customText || customization.custom_text || null;
    const rawSongTitle = item.songTitle || item.song_title || customization.songTitle || customization.song_title || null;
    const rawArtistName = item.artistName || item.artist_name || customization.artistName || customization.artist_name || null;
    const rawPreviewConfig = item.previewConfig || item.preview_config || customization.previewConfig || customization.previewData || null;

    let spotifyCode = null;
    let validSpotifyUrl = null;

    if (product.is_customizable && rawSpotifyUrl) {
      const parsedSpotify = parseSpotifyUrl(rawSpotifyUrl);
      if (parsedSpotify.isValid) {
        validSpotifyUrl = parsedSpotify.url;
        spotifyCode = parsedSpotify.id;
      } else {
        validSpotifyUrl = rawSpotifyUrl;
        spotifyCode = rawSpotifyUrl;
      }
    }

    if (rawCustomText) {
      const textValidation = validateCustomText(rawCustomText);
      if (!textValidation.isValid) {
        const error = new Error(textValidation.error);
        error.status = 400;
        throw error;
      }
    }

    const itemUnitPrice = Number(product.price);
    const itemTotalPrice = itemUnitPrice * quantity;
    subtotal += itemTotalPrice;

    processedItems.push({
      productId: product.id,
      productName: product.name,
      productSku: product.sku,
      unitPrice: itemUnitPrice,
      quantity,
      totalPrice: itemTotalPrice,
      spotifyUrl: validSpotifyUrl,
      spotifyCode: spotifyCode,
      songTitle: rawSongTitle ? sanitizeText(rawSongTitle, 100) : null,
      artistName: rawArtistName ? sanitizeText(rawArtistName, 100) : null,
      customText: rawCustomText ? sanitizeText(rawCustomText, 30) : null,
      previewConfig: rawPreviewConfig ? JSON.stringify(rawPreviewConfig) : null
    });
  }

  const shippingFee = 0; // Free tracked shipping across India
  const totalAmount = subtotal + shippingFee;

  return {
    subtotal,
    shippingFee,
    totalAmount,
    currency: 'INR',
    items: processedItems
  };
}

/**
 * Creates a new customer order in PENDING_PAYMENT state
 */
async function createOrder(orderData, userId = null) {
  const db = getDb();

  const customer = orderData.customer || {};
  const customerName = customer.name || orderData.customerName || orderData.name || (userId ? 'Customer' : '');
  const customerEmail = customer.email || orderData.customerEmail || orderData.email || '';
  const customerPhone = customer.phone || orderData.customerPhone || orderData.phone || '';

  if (!customerName || customerName.trim().length < 2) {
    const error = new Error('Customer full name is required.');
    error.status = 400;
    throw error;
  }

  if (!customerEmail || !isValidEmail(customerEmail)) {
    const error = new Error('A valid customer email address is required.');
    error.status = 400;
    throw error;
  }

  const shipping = orderData.shippingAddress || orderData.shipping || {};
  const addressLine1 = shipping.addressLine1 || shipping.line1 || shipping.street || orderData.shippingAddressLine1 || orderData.address || '';
  const addressLine2 = shipping.addressLine2 || shipping.line2 || orderData.shippingAddressLine2 || null;
  const city = shipping.city || orderData.shippingCity || orderData.city || '';
  const state = shipping.state || orderData.shippingState || orderData.state || '';
  const postalCode = shipping.postalCode || shipping.postal_code || shipping.pincode || orderData.shippingPostalCode || orderData.pincode || '';
  const country = shipping.country || orderData.shippingCountry || 'India';

  if (!addressLine1 || addressLine1.trim().length < 3) {
    const error = new Error('Shipping address line 1 is required.');
    error.status = 400;
    throw error;
  }

  if (!city || city.trim().length < 2) {
    const error = new Error('Shipping city is required.');
    error.status = 400;
    throw error;
  }

  if (!state || state.trim().length < 2) {
    const error = new Error('Shipping state is required.');
    error.status = 400;
    throw error;
  }

  if (!postalCode || !isValidPostalCode(postalCode)) {
    const error = new Error('Valid 6-digit postal/PIN code is required.');
    error.status = 400;
    throw error;
  }

  // Calculate pricing strictly from DB
  const rawItems = orderData.items || (orderData.productId ? [{ productId: orderData.productId, quantity: orderData.quantity !== undefined && orderData.quantity !== null ? orderData.quantity : 1, customization: orderData.customization }] : []);
  const calculated = await calculateOrderTotal(rawItems);

  const orderNumber = generateOrderNumber();

  let orderId = null;

  // Transactionally save order and order items
  const transactionFn = db.transaction(() => {
    const orderResult = db.prepare(`
      INSERT INTO orders (
        order_number, user_id, customer_name, customer_email, customer_phone,
        shipping_address_line1, shipping_address_line2, shipping_city, shipping_state,
        shipping_postal_code, shipping_country, total_amount, currency, status, payment_status, notes
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'INR', 'PENDING_PAYMENT', 'UNPAID', ?
      )
    `).run(
      orderNumber,
      userId || null,
      customerName.trim(),
      customerEmail.toLowerCase().trim(),
      customerPhone ? customerPhone.trim() : null,
      addressLine1.trim(),
      addressLine2 ? addressLine2.trim() : null,
      city.trim(),
      state.trim(),
      postalCode.trim(),
      country.trim(),
      calculated.totalAmount,
      orderData.notes ? sanitizeText(orderData.notes, 500) : null
    );

    orderId = orderResult.lastInsertRowid;

    const insertItemStmt = db.prepare(`
      INSERT INTO order_items (
        order_id, product_id, product_name, product_sku, unit_price,
        quantity, total_price, spotify_url, spotify_code, song_title,
        artist_name, custom_text, preview_config
      ) VALUES (
        @order_id, @product_id, @product_name, @product_sku, @unit_price,
        @quantity, @total_price, @spotify_url, @spotify_code, @song_title,
        @artist_name, @custom_text, @preview_config
      )
    `);

    for (const item of calculated.items) {
      insertItemStmt.run({
        order_id: orderId,
        product_id: item.productId,
        product_name: item.productName,
        product_sku: item.productSku,
        unit_price: item.unitPrice,
        quantity: item.quantity,
        total_price: item.totalPrice,
        spotify_url: item.spotifyUrl,
        spotify_code: item.spotifyCode,
        song_title: item.songTitle,
        artist_name: item.artistName,
        custom_text: item.customText,
        preview_config: item.previewConfig
      });
    }
  });

  transactionFn();

  logger.info(`Order placed successfully: ${orderNumber} (ID: ${orderId}), Total: ₹${calculated.totalAmount}`);

  return {
    id: orderId,
    orderId: orderId,
    orderNumber: orderNumber,
    order_number: orderNumber,
    totalAmount: calculated.totalAmount,
    total_amount: calculated.totalAmount,
    currency: 'INR',
    status: 'PENDING_PAYMENT',
    paymentStatus: 'UNPAID',
    customerName,
    customerEmail,
    itemCount: calculated.items.length,
    items: calculated.items,
    createdAt: new Date().toISOString()
  };
}

/**
 * Retrieves full order details by ID or Order Number
 */
async function getOrderDetails(idOrNumber) {
  const db = getDb();
  let orderRow = null;

  if (typeof idOrNumber === 'number' || (!isNaN(idOrNumber) && String(Number(idOrNumber)) === String(idOrNumber))) {
    orderRow = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(idOrNumber));
  }
  if (!orderRow) {
    orderRow = db.prepare('SELECT * FROM orders WHERE order_number = ? COLLATE NOCASE OR id = ?').get(idOrNumber, idOrNumber);
  }

  if (!orderRow) {
    const error = new Error(`Order '${idOrNumber}' not found.`);
    error.status = 404;
    throw error;
  }

  const items = db.prepare(`
    SELECT oi.*, p.image_url
    FROM order_items oi
    LEFT JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `).all(orderRow.id);

  const payments = db.prepare('SELECT * FROM payments WHERE order_id = ?').all(orderRow.id);

  return formatOrderResponse(orderRow, items, payments);
}

/**
 * Returns tracking information and live timeline
 */
async function getOrderTracking(idOrNumber, verificationEmailOrPhone = null) {
  const order = await getOrderDetails(idOrNumber);

  if (verificationEmailOrPhone) {
    const term = verificationEmailOrPhone.toLowerCase().trim();
    const emailMatch = order.customerEmail.toLowerCase() === term;
    const phoneMatch = order.customerPhone && order.customerPhone.replace(/\D/g, '').includes(term.replace(/\D/g, ''));
    if (!emailMatch && !phoneMatch) {
      const error = new Error('Order verification failed. Customer email or phone does not match.');
      error.status = 404;
      throw error;
    }
  }

  return {
    orderNumber: order.orderNumber,
    id: order.id,
    status: order.status,
    statusDisplay: getStatusDisplayName(order.status),
    customerName: order.customerName,
    totalAmount: order.totalAmount,
    currency: order.currency,
    courierName: order.courierName,
    trackingNumber: order.trackingNumber,
    shippingAddress: order.shippingAddress,
    items: order.items,
    timeline: buildTrackingTimeline(order.status, order.createdAt, order.updatedAt, order.paidAt),
    createdAt: order.createdAt,
    updatedAt: order.updatedAt
  };
}

/**
 * Returns all orders for a specific user ID or email
 */
async function getUserOrders(userId, email = null) {
  const db = getDb();
  let orders = [];

  if (userId) {
    orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(userId);
  } else if (email) {
    orders = db.prepare('SELECT * FROM orders WHERE customer_email = ? COLLATE NOCASE ORDER BY created_at DESC').all(email.toLowerCase().trim());
  }

  const result = [];
  for (const o of orders) {
    const items = db.prepare(`
      SELECT oi.*, p.image_url
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).all(o.id);
    result.push(formatOrderResponse(o, items));
  }

  return result;
}

function getStatusDisplayName(status) {
  const map = {
    'PENDING_PAYMENT': 'Pending Payment',
    'ORDER_RECEIVED': 'Order Received',
    'ENGRAVING': 'In Engraving',
    'QUALITY_CHECK': 'Quality Check',
    'DISPATCHED': 'Dispatched',
    'DELIVERED': 'Delivered',
    'CANCELLED': 'Cancelled',
    'REFUNDED': 'Refunded'
  };
  return map[status] || status;
}

function buildTrackingTimeline(status, createdAt, updatedAt, paidAt) {
  const steps = [
    { status: 'ORDER_RECEIVED', label: 'Order Received & Confirmed', description: 'Your custom order is locked in and ready for the laser studio.' },
    { status: 'ENGRAVING', label: '3D Printing & Laser Engraving', description: 'Your Spotify soundwave and custom text are being engraved in gold.' },
    { status: 'QUALITY_CHECK', label: 'Quality & Soundwave Scan Verification', description: 'Scanned via Spotify app camera to ensure 100% scan playability.' },
    { status: 'DISPATCHED', label: 'Dispatched with Courier', description: 'Handed over to express courier with live tracking number.' },
    { status: 'DELIVERED', label: 'Delivered to Doorstep', description: 'Package safely delivered.' }
  ];

  if (status === 'CANCELLED') {
    return [
      { status: 'ORDER_RECEIVED', label: 'Order Placed', completed: true, timestamp: createdAt },
      { status: 'CANCELLED', label: 'Order Cancelled', completed: true, current: true, timestamp: updatedAt }
    ];
  }

  const statusOrder = ['PENDING_PAYMENT', 'ORDER_RECEIVED', 'ENGRAVING', 'QUALITY_CHECK', 'DISPATCHED', 'DELIVERED'];
  const currentIndex = statusOrder.indexOf(status);

  return steps.map((step) => {
    const stepIndex = statusOrder.indexOf(step.status);
    const isCompleted = currentIndex >= stepIndex && currentIndex > 0;
    const isCurrent = step.status === status;

    let timestamp = null;
    if (step.status === 'ORDER_RECEIVED' && (paidAt || createdAt)) {
      timestamp = paidAt || createdAt;
    } else if (isCurrent) {
      timestamp = updatedAt;
    }

    return {
      status: step.status,
      label: step.label,
      description: step.description,
      completed: isCompleted,
      current: isCurrent,
      timestamp
    };
  });
}

function formatOrderResponse(orderRow, items = [], payments = []) {
  const formattedItems = items.map(it => ({
    id: it.id,
    productId: it.product_id,
    productName: it.product_name,
    productSku: it.product_sku,
    unitPrice: Number(it.unit_price),
    quantity: it.quantity,
    totalPrice: Number(it.total_price),
    imageUrl: it.image_url || 'POSTER 1.png',
    spotifyUrl: it.spotify_url,
    spotifyCode: it.spotify_code,
    songTitle: it.song_title,
    artistName: it.artist_name,
    customText: it.custom_text,
    customization: {
      spotifyUrl: it.spotify_url,
      spotifyCode: it.spotify_code,
      songTitle: it.song_title,
      artistName: it.artist_name,
      customText: it.custom_text,
      previewConfig: it.preview_config ? (typeof it.preview_config === 'string' ? JSON.parse(it.preview_config) : it.preview_config) : null
    }
  }));

  return {
    id: orderRow.id,
    orderNumber: orderRow.order_number,
    userId: orderRow.user_id,
    customerName: orderRow.customer_name,
    customerEmail: orderRow.customer_email,
    customerPhone: orderRow.customer_phone,
    shippingAddress: {
      line1: orderRow.shipping_address_line1,
      line2: orderRow.shipping_address_line2,
      city: orderRow.shipping_city,
      state: orderRow.shipping_state,
      postalCode: orderRow.shipping_postal_code,
      country: orderRow.shipping_country,
      formatted: `${orderRow.shipping_address_line1}${orderRow.shipping_address_line2 ? ', ' + orderRow.shipping_address_line2 : ''}, ${orderRow.shipping_city}, ${orderRow.shipping_state} - ${orderRow.shipping_postal_code}`
    },
    totalAmount: Number(orderRow.total_amount),
    currency: orderRow.currency,
    status: orderRow.status,
    statusDisplay: getStatusDisplayName(orderRow.status),
    paymentStatus: orderRow.payment_status,
    razorpayOrderId: orderRow.razorpay_order_id,
    razorpayPaymentId: orderRow.razorpay_payment_id,
    courierName: orderRow.courier_name,
    trackingNumber: orderRow.tracking_number,
    notes: orderRow.notes,
    items: formattedItems,
    payments: payments.map(p => ({
      id: p.id,
      razorpayOrderId: p.razorpay_order_id,
      razorpayPaymentId: p.razorpay_payment_id,
      amount: Number(p.amount),
      status: p.status,
      method: p.method,
      createdAt: p.created_at
    })),
    paidAt: orderRow.paid_at,
    createdAt: orderRow.created_at,
    updatedAt: orderRow.updated_at
  };
}

module.exports = {
  calculateOrderTotal,
  createOrder,
  getOrderDetails,
  getOrderTracking,
  getUserOrders,
  formatOrderResponse
};
