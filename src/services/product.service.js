const { getDb } = require('../config/database');
const logger = require('../utils/logger');

function mapProductRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    tagline: row.tagline || '',
    description: row.description || '',
    price: Number(row.price),
    originalPrice: row.original_price ? Number(row.original_price) : null,
    original_price: row.original_price ? Number(row.original_price) : null,
    currency: row.currency || 'INR',
    badge: row.badge || '',
    imageUrl: row.image_url,
    image_url: row.image_url,
    galleryImages: row.gallery_images ? JSON.parse(row.gallery_images) : [],
    category: row.category || 'keychain',
    isCustomizable: Boolean(row.is_customizable),
    is_customizable: Boolean(row.is_customizable),
    isActive: Boolean(row.is_active),
    is_active: Boolean(row.is_active),
    inStock: Boolean(row.in_stock),
    in_stock: Boolean(row.in_stock),
    comingSoon: Boolean(row.coming_soon),
    coming_soon: Boolean(row.coming_soon),
    stockStatus: row.stock_status || (row.in_stock ? 'in_stock' : 'out_of_stock'),
    stock_status: row.stock_status || (row.in_stock ? 'in_stock' : 'out_of_stock'),
    displayOrder: row.display_order || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Lists all active products
 */
async function getAllProducts({ inStockOnly = false, category = null, includeInactive = false } = {}) {
  const db = getDb();
  let query = 'SELECT * FROM products WHERE 1=1';
  const params = [];

  if (!includeInactive) {
    query += ' AND is_active = 1';
  }

  if (inStockOnly) {
    query += ' AND in_stock = 1';
  }

  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }

  query += ' ORDER BY display_order ASC, id ASC';

  const rows = db.prepare(query).all(...params);
  return rows.map(mapProductRow);
}

/**
 * Gets a single product by ID or SKU
 */
async function getProductById(idOrSku) {
  const db = getDb();
  let row = null;

  if (typeof idOrSku === 'number' || (!isNaN(idOrSku) && String(Number(idOrSku)) === String(idOrSku))) {
    row = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(idOrSku));
  } else {
    row = db.prepare('SELECT * FROM products WHERE sku = ? COLLATE NOCASE OR id = ?').get(idOrSku, idOrSku);
  }

  if (!row) {
    const error = new Error(`Product '${idOrSku}' not found.`);
    error.status = 404;
    throw error;
  }

  return mapProductRow(row);
}

/**
 * Creates a new product
 */
async function createProduct(data, adminUserId = null) {
  const db = getDb();

  const {
    sku,
    name,
    tagline = '',
    description,
    price,
    originalPrice,
    original_price,
    badge = '',
    imageUrl,
    image_url,
    category = 'keychain',
    isCustomizable = true,
    is_customizable = true,
    inStock = true,
    in_stock = true,
    comingSoon = false,
    coming_soon = false,
    displayOrder = 0
  } = data;

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    const error = new Error('Product name is required (at least 2 characters).');
    error.status = 400;
    throw error;
  }

  if (!sku || typeof sku !== 'string' || sku.trim().length < 2) {
    const error = new Error('Product SKU is required (at least 2 characters).');
    error.status = 400;
    throw error;
  }

  if (price === undefined || price === null || isNaN(Number(price)) || Number(price) < 0) {
    const error = new Error('Product price must be a non-negative number.');
    error.status = 400;
    throw error;
  }

  const normalizedSku = sku.trim().toUpperCase();
  const existingSku = db.prepare('SELECT id FROM products WHERE sku = ?').get(normalizedSku);
  if (existingSku) {
    const error = new Error(`Product with SKU '${normalizedSku}' already exists.`);
    error.status = 409;
    throw error;
  }

  const effectiveImageUrl = imageUrl || image_url || 'POSTER 1.png';
  const effectivePrice = Number(price);
  const effectiveOriginalPrice = (originalPrice || original_price) ? Number(originalPrice || original_price) : null;
  const effectiveInStock = (inStock !== undefined ? Boolean(inStock) : Boolean(in_stock)) ? 1 : 0;
  const effectiveComingSoon = (comingSoon !== undefined ? Boolean(comingSoon) : Boolean(coming_soon)) ? 1 : 0;
  const effectiveCustomizable = (isCustomizable !== undefined ? Boolean(isCustomizable) : Boolean(is_customizable)) ? 1 : 0;
  const stockStatus = effectiveComingSoon ? 'coming_soon' : (effectiveInStock ? 'in_stock' : 'out_of_stock');

  const result = db.prepare(`
    INSERT INTO products (
      sku, name, tagline, description, price, original_price, badge,
      image_url, category, is_customizable, is_active, in_stock, coming_soon,
      stock_status, display_order
    ) VALUES (
      @sku, @name, @tagline, @description, @price, @original_price, @badge,
      @image_url, @category, @is_customizable, 1, @in_stock, @coming_soon,
      @stock_status, @display_order
    )
  `).run({
    sku: normalizedSku,
    name: name.trim(),
    tagline: tagline ? tagline.trim() : null,
    description: description ? description.trim() : name.trim(),
    price: effectivePrice,
    original_price: effectiveOriginalPrice,
    badge: badge ? badge.trim() : null,
    image_url: effectiveImageUrl,
    category: category ? category.trim() : 'keychain',
    is_customizable: effectiveCustomizable,
    in_stock: effectiveInStock,
    coming_soon: effectiveComingSoon,
    stock_status: stockStatus,
    display_order: Number(displayOrder) || 0
  });

  const createdProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);

  // Admin audit log
  if (adminUserId) {
    db.prepare(`
      INSERT INTO admin_audit_logs (admin_user_id, action, target_entity, target_id, new_value)
      VALUES (?, 'CREATE_PRODUCT', 'products', ?, ?)
    `).run(adminUserId, String(createdProduct.id), JSON.stringify(createdProduct));
  }

  return mapProductRow(createdProduct);
}

/**
 * Updates an existing product
 */
async function updateProduct(id, data, adminUserId = null) {
  const db = getDb();
  const current = db.prepare('SELECT * FROM products WHERE id = ?').get(id);

  if (!current) {
    const error = new Error(`Product with ID ${id} not found.`);
    error.status = 404;
    throw error;
  }

  const updatedSku = data.sku ? data.sku.trim().toUpperCase() : current.sku;
  if (data.sku && updatedSku !== current.sku) {
    const conflict = db.prepare('SELECT id FROM products WHERE sku = ? AND id != ?').get(updatedSku, id);
    if (conflict) {
      const error = new Error(`Product SKU '${updatedSku}' is already taken.`);
      error.status = 409;
      throw error;
    }
  }

  const price = data.price !== undefined ? Number(data.price) : current.price;
  const originalPrice = (data.originalPrice !== undefined || data.original_price !== undefined)
    ? (data.originalPrice || data.original_price ? Number(data.originalPrice || data.original_price) : null)
    : current.original_price;

  const inStock = data.inStock !== undefined ? (data.inStock ? 1 : 0) : (data.in_stock !== undefined ? (data.in_stock ? 1 : 0) : current.in_stock);
  const comingSoon = data.comingSoon !== undefined ? (data.comingSoon ? 1 : 0) : (data.coming_soon !== undefined ? (data.coming_soon ? 1 : 0) : current.coming_soon);
  const isCustomizable = data.isCustomizable !== undefined ? (data.isCustomizable ? 1 : 0) : (data.is_customizable !== undefined ? (data.is_customizable ? 1 : 0) : current.is_customizable);
  const isActive = data.isActive !== undefined ? (data.isActive ? 1 : 0) : (data.is_active !== undefined ? (data.is_active ? 1 : 0) : current.is_active);
  const stockStatus = comingSoon ? 'coming_soon' : (inStock ? 'in_stock' : 'out_of_stock');

  db.prepare(`
    UPDATE products SET
      sku = @sku,
      name = @name,
      tagline = @tagline,
      description = @description,
      price = @price,
      original_price = @original_price,
      badge = @badge,
      image_url = @image_url,
      category = @category,
      is_customizable = @is_customizable,
      is_active = @is_active,
      in_stock = @in_stock,
      coming_soon = @coming_soon,
      stock_status = @stock_status,
      display_order = @display_order,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `).run({
    id,
    sku: updatedSku,
    name: data.name !== undefined ? data.name.trim() : current.name,
    tagline: data.tagline !== undefined ? (data.tagline ? data.tagline.trim() : null) : current.tagline,
    description: data.description !== undefined ? data.description.trim() : current.description,
    price,
    original_price: originalPrice,
    badge: data.badge !== undefined ? (data.badge ? data.badge.trim() : null) : current.badge,
    image_url: (data.imageUrl || data.image_url) ? (data.imageUrl || data.image_url) : current.image_url,
    category: data.category !== undefined ? data.category.trim() : current.category,
    is_customizable: isCustomizable,
    is_active: isActive,
    in_stock: inStock,
    coming_soon: comingSoon,
    stock_status: stockStatus,
    display_order: data.displayOrder !== undefined ? Number(data.displayOrder) : current.display_order
  });

  const updatedProduct = db.prepare('SELECT * FROM products WHERE id = ?').get(id);

  // Admin audit log
  if (adminUserId) {
    db.prepare(`
      INSERT INTO admin_audit_logs (admin_user_id, action, target_entity, target_id, old_value, new_value)
      VALUES (?, 'UPDATE_PRODUCT', 'products', ?, ?, ?)
    `).run(adminUserId, String(id), JSON.stringify(current), JSON.stringify(updatedProduct));
  }

  return mapProductRow(updatedProduct);
}

/**
 * Toggles product in_stock availability
 */
async function toggleProductStock(id, inStock, adminUserId = null) {
  const db = getDb();
  const current = db.prepare('SELECT * FROM products WHERE id = ?').get(id);

  if (!current) {
    const error = new Error(`Product with ID ${id} not found.`);
    error.status = 404;
    throw error;
  }

  const stockVal = inStock ? 1 : 0;
  const stockStatus = stockVal ? 'in_stock' : 'out_of_stock';

  db.prepare(`
    UPDATE products SET
      in_stock = ?,
      stock_status = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(stockVal, stockStatus, id);

  const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(id);

  if (adminUserId) {
    db.prepare(`
      INSERT INTO admin_audit_logs (admin_user_id, action, target_entity, target_id, old_value, new_value)
      VALUES (?, 'TOGGLE_STOCK', 'products', ?, ?, ?)
    `).run(adminUserId, String(id), JSON.stringify({ in_stock: current.in_stock }), JSON.stringify({ in_stock: stockVal }));
  }

  return mapProductRow(updated);
}

/**
 * Deletes or archives a product
 */
async function deleteProduct(id, adminUserId = null) {
  const db = getDb();
  const current = db.prepare('SELECT * FROM products WHERE id = ?').get(id);

  if (!current) {
    const error = new Error(`Product with ID ${id} not found.`);
    error.status = 404;
    throw error;
  }

  // Check if product is referenced in order items
  const orderCount = db.prepare('SELECT COUNT(*) as cnt FROM order_items WHERE product_id = ?').get(id)?.cnt || 0;

  if (orderCount > 0) {
    // Soft delete to protect historical order integrity
    db.prepare('UPDATE products SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
    logger.info(`Product ID ${id} has ${orderCount} existing order references; soft-deleted (is_active = 0).`);
  } else {
    db.prepare('DELETE FROM products WHERE id = ?').run(id);
    logger.info(`Product ID ${id} deleted from database.`);
  }

  if (adminUserId) {
    db.prepare(`
      INSERT INTO admin_audit_logs (admin_user_id, action, target_entity, target_id, old_value)
      VALUES (?, 'DELETE_PRODUCT', 'products', ?, ?)
    `).run(adminUserId, String(id), JSON.stringify(current));
  }

  return {
    success: true,
    deletedId: Number(id),
    message: 'Product removed from catalog successfully'
  };
}

module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  toggleProductStock,
  deleteProduct
};
