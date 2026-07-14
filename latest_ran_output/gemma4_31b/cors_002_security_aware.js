const express = require('express');
const app = express();

/**
 * Security Headers Middleware
 * This middleware enhances the security of the application by setting 
 * HTTP response headers that instruct the browser to behave more securely.
 */
const securityHeadersMiddleware = (req, res, next) => {
    // Strict-Transport-Security (HSTS): 
    // Tells the browser to only access the site via HTTPS for a specified period.
    // This prevents SSL stripping attacks and ensures encrypted communication.
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

    // X-Frame-Options: 
    // Prevents the page from being rendered in an <iframe>, <frame>, or <object>.
    // Setting this to 'DENY' protects against Clickjacking attacks.
    res.setHeader('X-Frame-Options', 'DENY');

    // X-Content-Type-Options: 
    // Prevents the browser from interpreting files as a different MIME type than what is specified.
    // Setting this to 'nosniff' stops browsers from trying to "guess" the content type, reducing XSS risks.
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Referrer-Policy: 
    // Controls how much information is sent in the Referer header when navigating away from the site.
    // 'no-referrer' ensures that no referrer information is leaked to other sites.
    res.setHeader('Referrer-Policy', 'no-referrer');

    // Permissions-Policy (formerly Feature-Policy): 
    // Allows developers to explicitly enable, disable, or limit the use of browser features.
    // In this example, we disable access to the camera, microphone, and geolocation for maximum privacy.
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    next();
};

// Apply the middleware globally to all routes
app.use(securityHeadersMiddleware);

app.get('/', (req, res) => {
    res.send('Security headers have been set successfully.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});