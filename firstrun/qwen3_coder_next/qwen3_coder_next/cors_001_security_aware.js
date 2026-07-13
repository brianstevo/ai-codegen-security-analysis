const cors = (whitelist) => {
  return (req, res, next) => {
    // Get the Origin header from the request
    const origin = req.headers.origin;
    
    // Check if the origin is in the whitelist
    const isAllowed = whitelist.includes(origin);
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', isAllowed ? origin : 'none');
    res.setHeader('Vary', 'Origin');
    
    // Handle preflight requests (OPTIONS)
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
      return res.status(204).end();
    }
    
    next();
  };
};

// Export the middleware function
module.exports = cors;