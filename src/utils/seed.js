const bcrypt = require('bcryptjs');
const { initializeDatabase, getDb } = require('../config/database');
const env = require('../config/env');
const logger = require('./logger');

async function seedDatabase() {
  await initializeDatabase();
  const db = getDb();
  logger.info('Running database seeder...');

  // 1. Seed Admin User
  const existingAdmin = db.prepare('SELECT id, email FROM users WHERE role = ? OR email = ?').get('admin', env.ADMIN_EMAIL);
  if (!existingAdmin) {
    const passwordHash = bcrypt.hashSync(env.ADMIN_PASSWORD, 10);
    db.prepare(`
      INSERT INTO users (email, password_hash, name, role)
      VALUES (?, ?, ?, 'admin')
    `).run(env.ADMIN_EMAIL, passwordHash, 'TuneTagZ Admin');
    logger.info(`Admin user created: ${env.ADMIN_EMAIL}`);
  } else {
    logger.info(`Admin user already exists: ${existingAdmin.email}`);
  }

  // 2. Seed Default Products
  const seedProducts = [
    {
      sku: 'SPT-001',
      name: 'Spotify Code Tag',
      tagline: 'Scan and play. Your favorite track engraved in gold on matte black.',
      description: 'Scan and play. Your favorite track engraved in gold on matte black — with your name on the back. The ultimate gift for any music lover.',
      price: 699.00,
      original_price: 899.00,
      badge: 'Bestseller',
      image_url: 'POSTER 1.png',
      category: 'keychain',
      is_customizable: 1,
      is_active: 1,
      in_stock: 1,
      coming_soon: 0,
      stock_status: 'in_stock',
      display_order: 1
    },
    {
      sku: 'RKY-001',
      name: 'Rocky Keychain',
      tagline: 'A wearable sculpture for your keys. Intricate maze-pattern 3D printed figure in matte black.',
      description: 'A wearable sculpture for your keys. Intricate maze-pattern 3D printed figure in matte black — bold, tactile, and unlike anything else on the market.',
      price: 300.00,
      original_price: 450.00,
      badge: 'New',
      image_url: 'POSTER 2.png',
      category: 'keychain',
      is_customizable: 0,
      is_active: 1,
      in_stock: 1,
      coming_soon: 0,
      stock_status: 'in_stock',
      display_order: 2
    },
    {
      sku: 'DRP-003',
      name: 'Drop 03 — Limited Edition',
      tagline: 'Something new is dropping. The third TuneTagZ collection.',
      description: 'Something new is dropping. Follow us on Instagram to be the first to know when our third collection goes live.',
      price: 0.00,
      original_price: null,
      badge: 'Coming Soon',
      image_url: 'PRODUCT 1.png',
      category: 'keychain',
      is_customizable: 1,
      is_active: 1,
      in_stock: 0,
      coming_soon: 1,
      stock_status: 'coming_soon',
      display_order: 3
    }
  ];

  const insertProductStmt = db.prepare(`
    INSERT OR IGNORE INTO products (
      sku, name, tagline, description, price, original_price, badge,
      image_url, category, is_customizable, is_active, in_stock, coming_soon,
      stock_status, display_order
    ) VALUES (
      @sku, @name, @tagline, @description, @price, @original_price, @badge,
      @image_url, @category, @is_customizable, @is_active, @in_stock, @coming_soon,
      @stock_status, @display_order
    )
  `);

  const updateProductStockStmt = db.prepare(`
    UPDATE products SET
      price = @price,
      original_price = @original_price,
      name = @name,
      description = @description,
      badge = @badge,
      image_url = @image_url,
      is_customizable = @is_customizable,
      is_active = @is_active
    WHERE sku = @sku
  `);

  for (const prod of seedProducts) {
    const existing = db.prepare('SELECT id FROM products WHERE sku = ?').get(prod.sku);
    if (!existing) {
      insertProductStmt.run(prod);
      logger.info(`Product seeded: ${prod.sku} - ${prod.name}`);
    } else {
      updateProductStockStmt.run(prod);
    }
  }

  // Clean up any test/extra products so only the 3 main products exist on the storefront
  if (process.env.NODE_ENV !== 'test') {
    db.prepare(`DELETE FROM products WHERE sku NOT IN ('SPT-001', 'RKY-001', 'DRP-003')`).run();
  }

  // 3. Seed Default Store Settings
  const defaultSettings = [
    { key: 'store_name', value: 'TuneTagZ', description: 'Store display name' },
    { key: 'contact_email', value: 'support@tunetagz.com', description: 'Customer support email' },
    { key: 'contact_phone', value: '+91 9876543210', description: 'Customer support phone number' },
    { key: 'instagram_url', value: 'https://www.instagram.com/tune.tagz/', description: 'Official Instagram profile' },
    { key: 'announcement_bar', value: 'Free Tracked Shipping Across India on All Orders!', description: 'Top announcement banner text' },
    { key: 'razorpay_mode', value: env.MOCK_PAYMENTS ? 'mock' : 'live', description: 'Payment mode: mock or live' }
  ];

  const insertSettingStmt = db.prepare(`
    INSERT OR IGNORE INTO admin_settings (key, value, description)
    VALUES (?, ?, ?)
  `);

  for (const s of defaultSettings) {
    insertSettingStmt.run(s.key, s.value, s.description);
  }

  logger.info('Database seeding completed successfully.');
}

if (require.main === module) {
  seedDatabase().catch((err) => {
    logger.error('Seed database error:', err);
    process.exit(1);
  });
}

module.exports = {
  seedDatabase
};
