/**
 * Global Express Error Handler
 * Catches any error passed via next(err)
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error('[Error]', err.message);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'Internal server error.',
  });
}

module.exports = errorHandler;
