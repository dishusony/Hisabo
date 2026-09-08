/**
 * errorHandler.js - Centralized Express Error Handling Middleware
 */

export function errorHandler(err, req, res, next) {
  console.error(`[Server Error] ${req.method} ${req.url}:`, err.message || err);

  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'Internal Server Error',
    status: 'error'
  });
}
