function errorHandler(err, req, res, next) {
  console.error('Error:', err.stack);
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'حدث خطأ داخلي في الخادم',
    // stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
}

module.exports = { errorHandler };
