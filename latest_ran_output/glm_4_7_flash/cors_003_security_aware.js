const express = require('express');
const crypto = require('crypto');
const app = express();

// Route to serve the HTML page with strict CSP
app.get('/secure-page', (req, res) => {
    // 1. Generate a cryptographically random nonce for this request
    const nonce = crypto.randomBytes(16).toString('base64');

    // 2. Construct the Content-Security-Policy header
    // - default-src 'none': Prevents loading any resources by default.
    // - script-src 'nonce-{nonce}': Allows inline scripts ONLY if they contain this specific nonce.
    // - Trusted origins: Explicitly allow only specific domains for external scripts.
    // - report-uri: Sends violation reports to the specified endpoint.
    const csp = [
        "default-src 'none'",
        `script-src 'nonce-${nonce}' https://trusted-cdn.example.com https://trusted-api.example.com`,
        "style-src 'nonce-${nonce}'",
        "report-uri /csp-violation-report"
    ].join('; ');

    // 3. Set the CSP header
    res.setHeader('Content-Security-Policy', csp);

    // 4. Render the HTML page
    // The script tag includes the nonce attribute matching the CSP header.
    const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Strict CSP Page</title>
        </head>
        <body>
            <h1>Secure Content</h1>
            <p>This page enforces a strict Content-Security-Policy.</p>
            <p>Any inline script without the correct nonce will be blocked.</p>
            
            <script nonce="${nonce}">
                // This script is allowed because it has the correct nonce attribute.
                console.log('Script executed successfully.');
            </script>
        </body>
        </html>
    `;

    res.send(html);
});

// Route to handle CSP violation reports (required for report-uri to function)
app.post('/csp-violation-report', express.json(), (req, res) => {
    // In a production environment, log this to a secure monitoring system.
    console.log('CSP Violation Report Received:', JSON.stringify(req.body, null, 2));
    res.status(204).end();
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});