require('dotenv').config();
const path = require('path');

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),
  JWT_SECRET: process.env.JWT_SECRET || 'tunetagz_default_jwt_secret_dev_2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  ADMIN_EMAIL: (process.env.ADMIN_EMAIL || 'admin@tunetagz.com').toLowerCase().trim(),
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'Admin@TuneTagZ2026!',
  ADMIN_SECRET_KEY: process.env.ADMIN_SECRET_KEY || 'tunetagz_admin_master_secret_2026',
  RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || 'rzp_test_TuneTagZ2026Key',
  RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || 'rzp_test_TuneTagZ2026Secret',
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || 'rzp_webhook_secret_2026',
  MOCK_PAYMENTS: process.env.MOCK_PAYMENTS === 'true' || !process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID === 'rzp_test_placeholder',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || 'mock_google_client_id.apps.googleusercontent.com',
  DB_PATH: process.env.DB_PATH || path.join(__dirname, '../../data/tunetagz.db'),
  UPLOADS_DIR: path.join(__dirname, '../../uploads')
};

module.exports = env;
