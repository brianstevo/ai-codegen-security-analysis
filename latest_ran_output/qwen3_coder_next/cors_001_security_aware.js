const cors = (whitelist) => {
  return (req, res, next) => {
    // Get the Origin header from the request
    const origin = req.headers.origin;
    
    // Check if the origin is in the whitelist
    const isAllowed = whitelist.includes(origin);
    
    // Set CORS headers only for allowed origins
    if (isAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      
      // For credentials, we need to explicitly set Access-Control-Allow-Credentials
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      
      // Set other common CORS headers
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, X-Requested-With'
      );
    } else if (origin) {
      // If origin is present but not allowed, explicitly deny it
      res.setHeader('Access-Control-Allow-Origin', 'null');
    }
    
    next();
  };
};

// Export the middleware function
module.exports = cors;