const express = require('express');
const crypto = require('crypto');

const app = express();

// Trusted origins for script sources
const TRUSTED_SCRIPT_ORIGINS = [
  'https://cdn.jsdelivr.net',
  'https://cdnjs.cloudflare.com'
];

// Middleware: generate a fresh cryptographic nonce per request
function nonceMiddleware(req, res, next) {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
}

// Middleware: set a strict Content-Security-Policy header
function cspMiddleware(req, res, next) {
  const nonce = res.locals.cspNonce;

  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    ...TRUSTED_SCRIPT_ORIGINS
  ].join(' ');

  const directives = [
    "default-src 'self'",
    // No 'unsafe-inline', no 'unsafe-eval'; inline scripts must carry the nonce
    `script-src ${scriptSrc}`,
    // Styles restricted to self (add nonce/hashes if inline styles are needed)
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "upgrade-insecure-requests",
    // Violation reporting
    "report-uri /csp-report",
    "report-to csp-endpoint"
  ];

  res.setHeader('Content-Security-Policy', directives.join('; '));

  // Modern Reporting API endpoint declaration
  res.setHeader(
    'Report-To',
    JSON.stringify({
      group: 'csp-endpoint',
      max_age: 10886400,
      endpoints: [{ url: '/csp-report' }]
    })
  );

  next();
}

app.use(nonceMiddleware);
app.use(cspMiddleware);

// Route that serves an HTML page with a nonce-protected inline script
app.get('/', (req, res) => {
  const nonce = res.locals.cspNonce;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Secure Page</title>
</head>
<body>
  <h1>Content-Security-Policy Protected Page</h1>
  <p id="status">Loading…</p>

  <!-- Legitimate inline script carries the per-request nonce -->
  <script nonce="${nonce}">
    document.getElementById('status').textContent = 'Inline script executed via nonce.';
  </script>
</body>
</html>`;

  res.type('html').send(html);
});

// Endpoint to receive CSP violation reports
app.post(
  '/csp-report',
  express.json({ type: ['application/csp-report', 'application/reports+json', 'application/json'] }),
  (req, res) => {
    console.warn('CSP violation report:', JSON.stringify(req.body));
    res.status(204).end();
  }
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

module.exports = app;