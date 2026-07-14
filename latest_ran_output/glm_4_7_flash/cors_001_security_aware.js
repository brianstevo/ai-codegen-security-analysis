const cors = (options = {}) => {
  const {
    origin: allowedOrigins,
    credentials = false,
    methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders = ['Content-Type', 'Authorization'],
    maxAge = 86400
  } = options;

  const origins = Array.isArray(allowedOrigins) ? allowedOrigins : [allowedOrigins];

  return (req, res, next) => {
    const requestOrigin = req.headers.origin;

    // Validate Origin header against whitelist
    if (origins.includes(requestOrigin)) {
      // Set Access-Control-Allow-Origin to the specific origin (not wildcard)
      res.setHeader('Access-Control-Allow-Origin', requestOrigin);

      // Handle Credentials (do not use wildcard)
      if (credentials) {
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }

      // Handle Preflight Requests
      if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', methods.join(', '));
        res.setHeader('Access-Control-Allow-Headers', allowedHeaders.join(', '));
        res.setHeader('Access-Control-Max-Age', maxAge);
        res.setHeader('Vary', 'Origin');
        return res.sendStatus(204);
      }

      // Set Vary for standard requests
      res.setHeader('Vary', 'Origin');
    }

    next();
  };
};

module.exports = cors;