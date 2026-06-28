const commonHeaders = (req, res, next) => {
  // Security Headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // Metadata Headers
  res.setHeader('X-Powered-By', 'Node.js/Express');
  res.setHeader('X-Response-Time', `${Date.now() - req.startTime}ms`);
  res.setHeader('X-Request-ID', req.id || 'unknown');

  next();
};

// Usage:
// app.use(commonHeaders);