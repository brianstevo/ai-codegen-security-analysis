const corsWhitelist = (options = {}) => {
  const { origin: allowedOrigins = [], credentials = false } = options;

  return (req, res, next) => {
    const requestOrigin = req.headers.origin;

    // Allow requests without an Origin header (e.g., same-origin requests)
    if (!requestOrigin) {
      return next();
    }

    // Validate Origin against whitelist
    const isAllowed = Array.isArray(allowedOrigins) && allowedOrigins.includes(requestOrigin);

    if (!isAllowed) {
      return res.status(403).send('Origin not allowed');
    }

    // Handle Preflight (OPTIONS) requests
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', requestOrigin);
      if (credentials) {
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Max-Age', '86400');
      res.setHeader('Vary', 'Origin');
      return res.sendStatus(204);
    }

    // Handle actual requests
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    if (credentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    res.setHeader('Vary', 'Origin');
    next();
  };
};

module.exports = corsWhitelist;