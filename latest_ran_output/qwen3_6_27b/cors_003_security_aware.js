const express = require('express');
const crypto = require('crypto');

const app = express();

// Middleware to generate a nonce for each request
app.use((req, res, next) => {
  req.nonce = crypto.randomBytes(16).toString('base64');
  next();
});

// Route serving the HTML page with strict CSP
app.get('/', (req, res) => {
  const nonce = req.nonce;
  
  // Define strict Content-Security-Policy header
  const cspHeader = `
    default-src 'self';
    script-src 'nonce-${nonce}' https://trusted.cdn.com;
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https://images.example.com;
    connect-src 'self';
    font-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    report-uri /csp-report-endpoint;
    block-all-mixed-content;
  `.replace(/\s+/g, ' ').trim();

  res.set('Content-Security-Policy', cspHeader);

  // Serve HTML with inline script using the nonce
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Strict CSP Page</title>
    </head>
    <body>
      <h1>Hello, Secure World!</h1>
      <p>This page uses a strict Content-Security-Policy with nonces.</p>
      <script nonce="${nonce}">
        console.log('This inline script is allowed because it has the correct nonce.');
        document.body.style.backgroundColor = '#f0f0f0';
      </script>
    </body>
    </html>
  `;

  res.send(html);
});

// Endpoint to receive CSP violation reports
app.post('/csp-report-endpoint', (req, res) => {
  console.log('CSP Violation Report:', req.body);
  res.status(204).send();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});