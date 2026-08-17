const multer = require('multer');
const logger = require('../utils/logger');

/**
 * Centralized error handler middleware
 */
function errorHandler(err, req, res, next) {
  logger.error(`${req.method} ${req.originalUrl || req.url} - Error:`, err.message || err);

  // 1. Multer specific errors
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'File too large. Maximum file size allowed is 5MB.'
      });
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        success: false,
        error: `Unexpected field in multipart form: ${err.field}`
      });
    }
    return res.status(400).json({
      success: false,
      error: `File upload error: ${err.message}`
    });
  }

  // 2. SyntaxError (malformed JSON body parser error)
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: 'Malformed JSON payload.'
    });
  }

  // 3. Status set on error object
  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  return res.status(statusCode).json({
    success: false,
    error: message,
    details: err.details || undefined
  });
}

module.exports = errorHandler;
