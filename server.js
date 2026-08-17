const app = require('./src/app');
const env = require('./src/config/env');
const { initializeDatabase, getDb } = require('./src/config/database');
const { seedDatabase } = require('./src/utils/seed');
const logger = require('./src/utils/logger');

let server = null;

async function startServer() {
  try {
    logger.info('Starting TuneTagZ Backend Server...');

    // 1. Initialize SQLite Database
    await initializeDatabase();

    // 2. Auto-seed initial catalog and admin user
    await seedDatabase();

    // 3. Start Express HTTP Server
    server = app.listen(env.PORT, () => {
      logger.info(`=======================================================`);
      logger.info(`🎵 TuneTagZ Server running on http://localhost:${env.PORT}`);
      logger.info(`🔑 Admin: ${env.ADMIN_EMAIL}`);
      logger.info(`💳 Payments Mode: ${env.MOCK_PAYMENTS ? 'MOCK (Sandbox)' : 'LIVE'}`);
      logger.info(`📂 Database: ${env.DB_PATH}`);
      logger.info(`📁 Uploads: ${env.UPLOADS_DIR}`);
      logger.info(`=======================================================`);
    });

    server.on('error', (err) => {
      logger.error('Server failed to start:', err);
    });

  } catch (err) {
    logger.error('Fatal error during server startup:', err);
    process.exit(1);
  }
}

// Graceful Shutdown
function handleShutdown(signal) {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed.');
      try {
        const db = getDb();
        if (db && typeof db.close === 'function') {
          db.close();
          logger.info('SQLite database closed.');
        }
      } catch (e) {
        // ignore
      }
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

if (require.main === module) {
  startServer();
}

module.exports = {
  startServer,
  app
};
