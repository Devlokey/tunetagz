const express = require('express');
const path = require('path');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const env = require('./config/env');
const { getDb } = require('./config/database');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');
const { parseSpotifyUrl, generateSpotifyCodeSvg } = require('./services/spotify.service');

// Import Route Handlers
const authRoutes = require('./routes/auth.routes');
const productRoutes = require('./routes/product.routes');
const orderRoutes = require('./routes/order.routes');
const paymentRoutes = require('./routes/payment.routes');
const adminRoutes = require('./routes/admin.routes');

const app = express();

// Global Middlewares
app.use(cors({
  origin: true,
  credentials: true
}));

// HTTP Request logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Cookie parser
app.use(cookieParser());

// Capture raw body for webhook verification
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  },
  limit: '10mb'
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static Assets
app.use('/uploads', express.static(env.UPLOADS_DIR));
app.use('/public', express.static(path.join(__dirname, '../public')));
app.use(express.static(path.join(__dirname, '..'))); // Root static files (index.html, admin.html, POSTER images, etc.)

// Health Check Endpoint
app.get(['/api/health', '/health'], (req, res) => {
  let dbConnected = false;
  try {
    const db = getDb();
    const test = db.prepare('SELECT 1 as val').get();
    dbConnected = test && test.val === 1;
  } catch (e) {
    dbConnected = false;
  }

  return res.status(200).json({
    status: 'ok',
    service: 'tunetagz-backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: {
      type: 'sqlite',
      connected: dbConnected,
      tables: ['users', 'products', 'orders', 'order_items', 'payments', 'admin_audit_logs', 'admin_settings']
    }
  });
});

// Spotify Customizer Preview Utility Endpoint
app.get('/api/spotify/preview', (req, res) => {
  const url = req.query.url || req.query.uri;
  if (!url) {
    return res.status(400).json({ success: false, error: 'Spotify URL or URI query parameter is required.' });
  }
  const parsed = parseSpotifyUrl(url);
  const svg = generateSpotifyCodeSvg(parsed.id || 'default');
  return res.status(200).json({
    success: true,
    spotify: parsed,
    svg
  });
});

// Mount Core REST API Endpoints
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);

// Fallback direct routes for admin portal or tracking pages
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../admin.html'));
});

// 404 handler for API routes
app.all('/api/*', (req, res) => {
  return res.status(404).json({
    success: false,
    error: `API endpoint ${req.method} ${req.originalUrl} not found.`
  });
});

// Centralized Error Handling Middleware
app.use(errorHandler);

module.exports = app;
