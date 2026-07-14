const express = require('express');
const crypto = require('crypto');
const router = express.Router();

router.get('/', (req, res) => {
    // Generate a unique nonce for this request
    const nonce = crypto.randomBytes(16).toString('base64');

    // Set strict CSP header with nonce and report-uri
    const cspHeader = `
        default-src 'self';
        script-src 'self' 'nonce-${nonce}' https://cdn.example.com;
        style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
        img-src 'self' data: https://images.example.com;
        font-src 'self' https://fonts.gstatic.com;
        connect-src 'self';
        frame-src 'none';
        object-src 'none';
        base-uri 'self';
        form-action 'self';
        report-uri /csp-report-endpoint
    `.replace(/\s+/g, ' ').trim();

    res.setHeader('Content-Security-Policy', cspHeader);
    res.setHeader('Content-Type', 'text/html');

    // HTML with nonce-protected inline script
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Secure Page</title>
            <meta http-equiv="Content-Security-Policy" content="${cspHeader.replace(/'/g, "\\'")}">
        </head>
        <body>
            <h1>Welcome to the Secure Page</h1>

            <!-- External script from trusted CDN -->
            <script src="https://cdn.example.com/trusted-library.js"></script>

            <!-- Nonce-protected inline script -->
            <script nonce="${nonce}">
                console.log('This is a safe inline script');
                document.addEventListener('DOMContentLoaded', function() {
                    alert('Page loaded securely!');
                });
            </script>
        </body>
        </html>
    `;

    res.send(html);
});

// CSP violation report endpoint
router.post('/csp-report-endpoint', express.json(), (req, res) => {
    console.log('CSP Violation Report:', req.body);
    res.status(204).end();
});

module.exports = router;