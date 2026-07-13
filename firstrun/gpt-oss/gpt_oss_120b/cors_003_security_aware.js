const express = require('express');
const crypto = require('crypto');

const app = express();

// Middleware to generate a per‑request nonce and set CSP header
function cspNonce(req, res, next) {
  const nonce = crypto.randomBytes(16).toString('base64'); // 128‑bit nonce
  res.locals.nonce = nonce;

  const cspDirectives = [
    "default-src 'self'",
    `script-src 'nonce-${nonce}' https://trusted.cdn.com`,
    "style-src 'self' https://trusted.cdn.com",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "report-uri /csp-report"
  ].join('; ');
  
  res.setHeader('Content-Security-Policy', cspDirectives);
  next();
}

// Endpoint to receive CSP violation reports
app.post(
  '/csp-report',
  express.json({ type: ['application/csp-report', 'application/json'] }),
  (req, res) => {
    console.error('CSP Violation:', req.body);
    // Acknowledge receipt without content
    res.status(204).end();
  }
);

// Secure page route
app.get('/secure-page', cspNonce, (req, res) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Secure Page</title>
</head>
<body>
<h1>Hello Secure World</h1>

<!-- Legitimate inline script with per‑request nonce -->
<script nonce="${res.locals.nonce}">
  console.log('Inline script executed with valid nonce');
</script>

<!-- External trusted script -->
<script src="https://trusted.cdn.com/library.js"></script>
</body>
</html>`;

  res.type('html').send(html);
});

app.listen(3000, () => {
  console.log('Server listening on http://localhost:3000');
});