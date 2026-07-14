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
 * Route serving the HTML page with a strict CSP header
 */
app.get('/', (req, res) => {
    const nonce = res.locals.nonce;
    
    // Define trusted origins for scripts
    const trustedOrigins = ["https://cdn.jsdelivr.net", "https://apis.google.com"];
    
    // Construct the CSP string
    // - default-src 'self': Fallback to only allow content from the same origin
    // - script-src: Allow self, specific trusted domains, and scripts with the correct nonce
    // - object-src 'none': Prevent plugins like Flash
    // - base-uri 'self': Restrict <base> tag to current origin
    const cspHeader = [
        `default-src 'self'`,
        `script-src 'self' ${trustedOrigins.join(' ')} 'nonce-${nonce}'`,
        `object-src 'none'`,
        `base-uri 'self'`,
        `report-uri /csp-report`
    ].join('; ');

    res.setHeader('Content-Security-Policy', cspHeader);

    // HTML content utilizing the nonce for an inline script
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>Strict CSP Page</title>
        </head>
        <body>
            <h1>Content Security Policy Implementation</h1>
            <p>This page uses a per-request nonce to allow specific inline scripts.</p>

            <!-- This script will execute because the nonce matches -->
            <script nonce="${nonce}">
                console.log('Legitimate inline script executed via nonce!');
            </script>

            <!-- This script would be blocked by CSP as it lacks a nonce or trusted source -->
            <script>
                alert('This should NOT run');
            </script>

            <!-- Example of loading from a trusted origin defined in the header -->
            <script src="https://cdn.jsdelivr.net/npm/vue@3" nonce="${nonce}"></script>
        </body>
        </html>
    `);
});

/**
 * Endpoint to receive CSP violation reports
 */
app.post('/csp-report', (req, res) => {
    const report = req.body;
    console.error('CSP Violation Received:', JSON.stringify(report, null, 2));
    res.status(204).end();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});