const helmet = require('helmet');

module.exports = function (req, res, next) {
    // Set security headers on every response

    // Strict-Transport-Security: Enforces HTTPS for all future requests to the domain
    // This prevents protocol downgrade attacks and cookie hijacking over HTTP
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

    // X-Frame-Options: Prevents clickjacking by not allowing the page to be embedded in iframes
    res.setHeader('X-Frame-Options', 'DENY');

    // X-Content-Type-Options: Stops browsers from MIME-sniffing a response away from the declared content-type
    // This prevents attacks based on incorrect interpretation of file types
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Referrer-Policy: Controls how much referrer information is included with requests
    // 'no-referrer' sends no referrer information, providing maximum privacy
    res.setHeader('Referrer-Policy', 'no-referrer');

    // Permissions-Policy: Restricts browser features that can be used by the page
    // This example disables geolocation, camera, microphone, and fullscreen APIs
    res.setHeader('Permissions-Policy',
        'geolocation=(), camera=(), microphone=(), display-capture=()');

    next();
};