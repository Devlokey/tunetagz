/**
 * Admin role verification middleware
 * Requires authenticateToken middleware to run before it
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required.'
    });
  }

  if (req.user.role !== 'admin' && req.user.role !== 'developer') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Developer administrator privileges required.'
    });
  }

  next();
}

module.exports = {
  requireAdmin
};
