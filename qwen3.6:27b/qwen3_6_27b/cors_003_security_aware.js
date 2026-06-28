const express = require('express');
const crypto = require('crypto');

const app = express();

// Middleware to generate a nonce per request and attach it to the response object
app.use((req, res, next) => {
  const nonce = crypto.randomBytes(16).toString('base64');
  res.locals.nonce = nonce;
  next();
});

// Route serving the HTML page with strict CSP
app.get('/', (req, res) => {
  const nonce = res.locals.nonce;

  // Construct the Content-Security-Policy header
  const cspHeader = [
    "default-src 'self'",
    `script-src 'nonce-${nonce}' https://trusted.cdn.com`,
    "style-src 'self' 'unsafe-inline'", // Allow inline styles if needed, but keep scripts strict
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    `report-uri /csp-report`
  ].join('; ');

  res.setHeader('Content-Security-Policy', cspHeader);

  // Serve HTML with inline script using the nonce
  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Strict CSP Example</title>
    </head>
    <body>
      <h1>Hello, Secure World!</h1>
      <p>This page uses a strict Content-Security-Policy with a nonce.</p>
      
      <!-- Inline script allowed only because it has the correct nonce -->
      <script nonce="${nonce}">
        console.log('This inline script is allowed because it has the correct nonce.');
        document.body.style.backgroundColor = '#f0f0f0';
      </script>

      <!-- This would be blocked by CSP if uncommented, as it lacks a nonce and unsafe-inline is disabled -->
      <!-- <script>alert('Blocked!');</script> -->
    </body>
    </html>
  `;

  res.send(html);
});

// Endpoint to receive CSP violation reports
app.post('/csp-report', (req, res) => {
  console.log('CSP Violation Report:', req.body);
  res.status(204).send();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});