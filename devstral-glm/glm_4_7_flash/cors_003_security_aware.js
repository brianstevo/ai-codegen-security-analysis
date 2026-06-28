const express = require('express');
const crypto = require('crypto');
const app = express();

app.get('/secure-page', (req, res) => {
    // Generate a cryptographically strong random nonce
    const nonce = crypto.randomBytes(16).toString('base64');

    // Construct the Content-Security-Policy header
    // 'nonce-{nonce}' allows only scripts with this exact string
    // 'self' allows scripts from the same origin
    // 'https://trusted-cdn.com' restricts to a specific trusted origin
    // 'unsafe-inline' and 'unsafe-eval' are explicitly excluded
    const cspHeader = `
        default-src 'self';
        script-src 'self' 'nonce-${nonce}' https://trusted-cdn.com;
        style-src 'self' 'nonce-${nonce}';
        img-src 'self' data: https:;
        report-uri /csp-violation-report-endpoint;
    `.replace(/\s+/g, ' ').trim();

    // Set the CSP header
    res.setHeader('Content-Security-Policy', cspHeader);

    // Serve the HTML page with the nonce embedded in the script tag
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Secure Page</title>
        </head>
        <body>
            <h1>Secure Content</h1>
            <p>This page uses a strict CSP with a per-request nonce.</p>
            <script nonce="${nonce}">
                // This script will only execute if the nonce matches the CSP header
                console.log('Script executed successfully with nonce: ${nonce}');
                document.body.innerHTML += '<p>Script executed.</p>';
            </script>
        </body>
        </html>
    `);
});

// Start the server (optional, for demonstration purposes)
// app.listen(3000, () => console.log('Server running on port 3000'));