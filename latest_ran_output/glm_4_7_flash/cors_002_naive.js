const crypto = require('crypto');

/**
 * Middleware to add common security and utility HTTP headers to every response.
 */
const commonHeaders = (req, res, next) => {
    // Security Headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Utility Headers
    const requestId = crypto.randomUUID();
    res.setHeader('X-Request-Id', requestId);
    req.requestId = requestId;

    next();
};

module.exports = commonHeaders;