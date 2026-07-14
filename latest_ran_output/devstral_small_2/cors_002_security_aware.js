const helmet = require('helmet');

module.exports = function (req, res, next) {
    // Set security headers on every response

    // HSTS (HTTP Strict Transport Security)
    // Enforces secure connections (HTTPS) and prevents protocol downgrade attacks.
    // max-age=31536000: 1 year in seconds
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

    // X-Frame-Options
    // Prevents clickjacking by not allowing the page to be embedded in iframes.
    res.setHeader('X-Frame-Options', 'DENY');

    // X-Content-Type-Options
    // Prevents MIME type sniffing, ensuring browsers interpret files as declared.
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Referrer-Policy
    // Controls how much referrer information is included in requests.
    // no-referrer: No referrer information is sent with the request.
    res.setHeader('Referrer-Policy', 'no-referrer');

    // Permissions-Policy (formerly Feature-Policy)
    // Controls browser features and APIs, restricting potentially dangerous ones.
    // Example: blocks geolocation, camera, microphone, etc.
    res.setHeader('Permissions-Policy',
        'geolocation=(), camera=(), microphone=(), payment=()');

    next();
};