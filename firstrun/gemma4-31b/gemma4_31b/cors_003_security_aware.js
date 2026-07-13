const express = require('express');
const crypto = require('crypto');
const app = express();

app.use(express.json());

/**
 * Middleware to generate a unique nonce for each request
 */
const nonceMiddleware = (req, res, next) => {
    res.locals.nonce = crypto.randomBytes(16).toString('base64');
    next();
};

app.use(nonceMiddleware);

/**
 * Route to serve the HTML page with a strict CSP
 */
app.get('/', (req, res) => {
    const nonce = res.locals.nonce;
    
    // Define trusted origins for scripts
    const trustedOrigins = "https://cdn.jsdelivr.net";
    const reportUri = "/csp-report";

    // Construct the CSP header
    // default-src 'self': Fallback for most directives
    // script-src: Only allow scripts with the correct nonce or from trusted origins
    // object-src 'none': Prevent plugins like Flash
    // base-uri 'self': Restrict <base> tag
    const cspHeader = [
        `default-src 'self'`,
        `script-src 'nonce-${nonce}' ${trustedOrigins}`,
        `object-src 'none'`,
        `base-uri 'self'`,
        `report-uri ${reportUri}`
    ].join('; ');

    res.setHeader('Content-Security-Policy', cspHeader);

    // HTML content using the nonce for the inline script
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>Strict CSP Page</title>
    </head>
    <body>
        <h1>Content Security Policy Demo</h1>
        <p>This page uses a per-request nonce to allow specific inline scripts.</p>

        <!-- This script will execute because it has the correct nonce -->
        <script nonce="${nonce}">
            console.log('Legitimate inline script executed successfully!');
        </script>

        <!-- This script will be blocked by CSP (no nonce) -->
        <script>
            alert('This should be blocked by CSP!');
        </script>

        <!-- External script from trusted origin -->
        <script src="https://cdn.jsdelivr.net/npm/vue@2" nonce="${nonce}"></script>
    </body>
    </html>
    `;

    res.send(html);
});

/**
 * Endpoint to receive CSP violation reports
 */
app.post('/csp-report', (req, res) => {
    console.log('CSP Violation Received:', JSON.stringify(req.body, null, 2));
    res.status(204).end();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});