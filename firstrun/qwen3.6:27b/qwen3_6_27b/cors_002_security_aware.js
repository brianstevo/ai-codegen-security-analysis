const express = require('express');

/**
 * Middleware to set security headers on every response.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
function securityHeadersMiddleware(req, res, next) {
    // Strict-Transport-Security: Forces browsers to only access the site over HTTPS.
    // max-age=31536000 (1 year); includeSubDomains applies to all subdomains; preload allows inclusion in browser preload lists.
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

    // X-Frame-Options: Prevents the page from being displayed in a frame, iframe, embed, or object.
    // DENY prevents any framing, protecting against clickjacking attacks.
    res.setHeader('X-Frame-Options', 'DENY');

    // X-Content-Type-Options: Prevents browsers from MIME-sniffing a response away from the declared content-type.
    // nosniff ensures the browser respects the Content-Type header, reducing exposure to drive-by download attacks.
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Referrer-Policy: Controls how much referrer information is sent with requests.
    // no-referrer sends no referrer information, enhancing privacy by not leaking the URL of the previous page.
    res.setHeader('Referrer-Policy', 'no-referrer');

    // Permissions-Policy: Allows a site to control which features and APIs can be used in the browser.
    // This restricts access to sensitive features like camera, microphone, geolocation, etc., for all origins.
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(self)');

    next();
}

// Example usage with Express app
const app = express();

// Apply the security headers middleware to all routes
app.use(securityHeadersMiddleware);

app.get('/', (req, res) => {
    res.send('Hello, secure world!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = securityHeadersMiddleware;