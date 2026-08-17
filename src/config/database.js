const path = require('path');
const fs = require('fs');
const env = require('./env');
const logger = require('../utils/logger');

let dbInstance = null;
let initPromise = null;

/**
 * Initializes the SQLite database engine.
 * Supports better-sqlite3, sqlite3, or sql.js (WebAssembly SQLite).
 */
async function initializeDatabase() {
  if (dbInstance) return dbInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const dbFilePath = path.resolve(env.DB_PATH);
    const dbDir = path.dirname(dbFilePath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // 1. Try better-sqlite3
    try {
      const Database = require('better-sqlite3');
      const bDb = new Database(dbFilePath);
      bDb.exec('PRAGMA journal_mode = WAL;');
      bDb.exec('PRAGMA foreign_keys = ON;');
      createTables(bDb);
      dbInstance = bDb;
      logger.info(`Connected to SQLite database via better-sqlite3 at ${dbFilePath}`);
      return dbInstance;
    } catch (err) {
      // logger.debug('better-sqlite3 not loaded:', err.message);
    }

    // 2. Pure WebAssembly SQLite (sql.js)
    logger.info('Initializing SQLite via WebAssembly (sql.js)...');
    const initSqlJs = require('sql.js');

    const wasmBinaryPath = path.join(path.dirname(require.resolve('sql.js')), 'sql-wasm.wasm');
    let wasmBinary = null;
    if (fs.existsSync(wasmBinaryPath)) {
      wasmBinary = fs.readFileSync(wasmBinaryPath);
    }

    const SQL = await initSqlJs(wasmBinary ? { wasmBinary } : {});

    let fileBuffer = null;
    if (fs.existsSync(dbFilePath)) {
      fileBuffer = fs.readFileSync(dbFilePath);
    }

    const rawDb = fileBuffer && fileBuffer.length > 0
      ? new SQL.Database(new Uint8Array(fileBuffer))
      : new SQL.Database();

    let inTransaction = false;

    function persist() {
      if (inTransaction) return; // Do not export mid-transaction
      try {
        const data = rawDb.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(dbFilePath, buffer);
      } catch (e) {
        logger.error('Failed to persist SQLite database to disk:', e.message);
      }
    }

    // Build the unified adapter
    const adapter = {
      prepare(sql) {
        return {
          get(...params) {
            const normParams = normalizeParams(sql, params);
            const stmt = rawDb.prepare(sql);
            try {
              if (normParams) {
                stmt.bind(normParams);
              }
              if (stmt.step()) {
                const row = stmt.getAsObject();
                stmt.free();
                return convertSqlTypes(row);
              }
              stmt.free();
              return undefined;
            } catch (e) {
              stmt.free();
              throw e;
            }
          },
          all(...params) {
            const normParams = normalizeParams(sql, params);
            const stmt = rawDb.prepare(sql);
            const results = [];
            try {
              if (normParams) {
                stmt.bind(normParams);
              }
              while (stmt.step()) {
                results.push(convertSqlTypes(stmt.getAsObject()));
              }
              stmt.free();
              return results;
            } catch (e) {
              stmt.free();
              throw e;
            }
          },
          run(...params) {
            const normParams = normalizeParams(sql, params);
            const stmt = rawDb.prepare(sql);
            try {
              if (normParams) {
                stmt.bind(normParams);
              }
              stmt.step();
              stmt.free();

              // Get last insert rowid and changes
              const lastIdRes = rawDb.exec('SELECT last_insert_rowid() AS id, changes() AS ch');
              let lastInsertRowid = 0;
              let changes = 0;
              if (lastIdRes && lastIdRes.length > 0 && lastIdRes[0].values.length > 0) {
                lastInsertRowid = lastIdRes[0].values[0][0];
                changes = lastIdRes[0].values[0][1];
              }
              persist();
              return { lastInsertRowid, changes };
            } catch (e) {
              stmt.free();
              throw e;
            }
          }
        };
      },
      exec(sql) {
        rawDb.exec(sql);
        persist();
      },
      transaction(fn) {
        return (...args) => {
          inTransaction = true;
          rawDb.exec('BEGIN TRANSACTION;');
          try {
            const result = fn(...args);
            rawDb.exec('COMMIT;');
            inTransaction = false;
            persist();
            return result;
          } catch (err) {
            try {
              rawDb.exec('ROLLBACK;');
            } catch (rbErr) {
              // Ignore rollback errors if transaction was already aborted
            }
            inTransaction = false;
            throw err;
          }
        };
      },
      close() {
        persist();
        rawDb.close();
      }
    };

    createTables(adapter);
    dbInstance = adapter;
    logger.info(`Connected to SQLite database via sql.js at ${dbFilePath}`);
    return dbInstance;
  })();

  return initPromise;
}

function normalizeParams(sql, params) {
  if (!params || params.length === 0) return null;
  if (params.length === 1 && typeof params[0] === 'object' && params[0] !== null && !Array.isArray(params[0])) {
    const obj = params[0];
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      const val = v === undefined ? null : v;
      if (sql.includes(`@${k}`)) {
        out[`@${k}`] = val;
      } else if (sql.includes(`:${k}`)) {
        out[`:${k}`] = val;
      } else if (sql.includes(`$${k}`)) {
        out[`$${k}`] = val;
      } else {
        out[`@${k}`] = val;
      }
    }
    return out;
  }
  // Positional array
  return params.map(p => (p === undefined ? null : p));
}

function convertSqlTypes(row) {
  if (!row) return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = v;
  }
  return out;
}

function createTables(database) {
  const schemaSQL = `
    -- 1. USERS TABLE
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT NULL,
      name TEXT NOT NULL,
      phone TEXT NULL,
      google_id TEXT UNIQUE NULL,
      avatar_url TEXT NULL,
      role TEXT NOT NULL DEFAULT 'customer' CHECK(role IN ('customer', 'admin', 'developer')),
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- 2. PRODUCTS TABLE
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      tagline TEXT NULL,
      description TEXT NOT NULL,
      price REAL NOT NULL CHECK(price >= 0),
      original_price REAL NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      badge TEXT NULL,
      image_url TEXT NOT NULL,
      gallery_images TEXT NULL,
      category TEXT NOT NULL DEFAULT 'keychain',
      is_customizable INTEGER NOT NULL DEFAULT 1 CHECK(is_customizable IN (0, 1)),
      is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
      in_stock INTEGER NOT NULL DEFAULT 1 CHECK(in_stock IN (0, 1)),
      coming_soon INTEGER NOT NULL DEFAULT 0 CHECK(coming_soon IN (0, 1)),
      stock_status TEXT NOT NULL DEFAULT 'in_stock' CHECK(stock_status IN ('in_stock', 'out_of_stock', 'preorder', 'coming_soon')),
      display_order INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- 3. ORDERS TABLE
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT UNIQUE NOT NULL,
      user_id INTEGER NULL,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL COLLATE NOCASE,
      customer_phone TEXT NOT NULL,
      shipping_address_line1 TEXT NOT NULL,
      shipping_address_line2 TEXT NULL,
      shipping_city TEXT NOT NULL,
      shipping_state TEXT NOT NULL,
      shipping_postal_code TEXT NOT NULL,
      shipping_country TEXT NOT NULL DEFAULT 'India',
      total_amount REAL NOT NULL CHECK(total_amount >= 0),
      currency TEXT NOT NULL DEFAULT 'INR',
      status TEXT NOT NULL DEFAULT 'PENDING_PAYMENT' 
        CHECK(status IN ('PENDING_PAYMENT', 'ORDER_RECEIVED', 'ENGRAVING', 'QUALITY_CHECK', 'DISPATCHED', 'DELIVERED', 'CANCELLED', 'REFUNDED')),
      payment_status TEXT NOT NULL DEFAULT 'UNPAID'
        CHECK(payment_status IN ('UNPAID', 'PAID', 'FAILED', 'REFUNDED')),
      razorpay_order_id TEXT NULL,
      razorpay_payment_id TEXT NULL,
      courier_name TEXT NULL,
      tracking_number TEXT NULL,
      notes TEXT NULL,
      paid_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    -- 4. ORDER ITEMS TABLE
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      product_sku TEXT NOT NULL,
      unit_price REAL NOT NULL CHECK(unit_price >= 0),
      quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity >= 1),
      total_price REAL NOT NULL CHECK(total_price >= 0),
      spotify_url TEXT NULL,
      spotify_code TEXT NULL,
      song_title TEXT NULL,
      artist_name TEXT NULL,
      custom_text TEXT NULL,
      preview_config TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
    );

    -- 5. PAYMENTS TABLE
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      razorpay_order_id TEXT NOT NULL,
      razorpay_payment_id TEXT UNIQUE NULL,
      razorpay_signature TEXT NULL,
      amount REAL NOT NULL CHECK(amount >= 0),
      currency TEXT NOT NULL DEFAULT 'INR',
      status TEXT NOT NULL DEFAULT 'CREATED' 
        CHECK(status IN ('CREATED', 'AUTHORIZED', 'CAPTURED', 'FAILED', 'REFUNDED')),
      method TEXT NULL,
      error_code TEXT NULL,
      error_description TEXT NULL,
      raw_webhook_payload TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
    );

    -- 6. ADMIN AUDIT LOGS TABLE
    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_user_id INTEGER NULL,
      action TEXT NOT NULL,
      target_entity TEXT NOT NULL,
      target_id TEXT NOT NULL,
      old_value TEXT NULL,
      new_value TEXT NULL,
      ip_address TEXT NULL,
      details TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    -- 7. ADMIN SETTINGS TABLE
    CREATE TABLE IF NOT EXISTS admin_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- INDEXES
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
    CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
    CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active, display_order);
    CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
    CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
    CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
    CREATE INDEX IF NOT EXISTS idx_payments_razorpay_order_id ON payments(razorpay_order_id);
    CREATE INDEX IF NOT EXISTS idx_payments_razorpay_payment_id ON payments(razorpay_payment_id);
  `;

  database.exec(schemaSQL);
  logger.info('Database schema tables and indexes initialized successfully.');
}

function getDb() {
  if (!dbInstance) {
    throw new Error('Database has not been initialized. Please call await initializeDatabase() first.');
  }
  return dbInstance;
}

module.exports = {
  initializeDatabase,
  getDb
};
