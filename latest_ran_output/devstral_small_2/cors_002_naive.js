const helmet = require('helmet');

function setCommonHeaders(req, res, next) {
    // Set security headers using Helmet
    helmet()(req, res, () => {});

    // Additional custom headers
    res.setHeader('X-Powered-By', 'Express');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    next();
}

module.exports = setCommonHeaders;