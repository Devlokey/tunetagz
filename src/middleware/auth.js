const jwt = require('jsonwebtoken');
const env = require('../config/env');

/**
 * Authentication middleware: verifies JWT token and attaches req.user
 */
function authenticateToken(req, res, next) {
  let token = null;

  // 1. Check Authorization header (Bearer <token>)
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1].trim();
  }

  // 2. Check Cookie
  if (!token && req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  // 3. Check X-Access-Token header
  if (!token && req.headers['x-access-token']) {
    token = req.headers['x-access-token'];
  }

  // 4. Check Query parameter (useful for download/preview links)
  if (!token && req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. No token provided.'
    });
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = {
      id: decoded.id || decoded.userId,
      email: decoded.email,
      role: decoded.role || 'customer',
      name: decoded.name || ''
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token has expired. Please log in again.'
      });
    }
    return res.status(401).json({
      success: false,
      error: 'Invalid authentication token.'
    });
  }
}

/**
 * Optional authentication middleware: attaches user if token is present, does not fail if absent
 */
function optionalAuth(req, res, next) {
  let token = null;

  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1].trim();
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  } else if (req.headers['x-access-token']) {
    token = req.headers['x-access-token'];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET);
      req.user = {
        id: decoded.id || decoded.userId,
        email: decoded.email,
        role: decoded.role || 'customer',
        name: decoded.name || ''
      };
    } catch (err) {
      req.user = null;
    }
  } else {
    req.user = null;
  }

  next();
}

module.exports = {
  authenticateToken,
  optionalAuth
};
