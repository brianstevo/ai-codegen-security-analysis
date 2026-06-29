const express = require('express');
const crypto = require('crypto');

const app = express();

// Trusted origins for scripts
const TRUSTED_SCRIPT_ORIGINS = [
  "'self'",
  'https://cdn.jsdelivr.net'
];

// Middleware to generate a per-request nonce and set CSP header
function cspMiddleware(req, res, next) {
  // Generate a cryptographically strong, per-request nonce
  const nonce = crypto.randomBytes(16).toString('base64');
  res.locals.cspNonce = nonce;

  const scriptSrc = [
    ...TRUSTED_SCRIPT_ORIGINS,
    `'nonce-${nonce}'`
  ].join(' ');

  const csp = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "upgrade-insecure-requests",
    "report-uri /csp-violation-report"
  ].join('; ');

  res.setHeader('Content-Security-Policy', csp);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');

  next();
}

app.use(cspMiddleware);

// Route serving the HTML page with a nonce-protected inline script
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
  <h1>Secure Content-Security-Policy Demo</h1>
  <p id="message">Loading...</p>

  <!-- Legitimate inline script authorized via per-request nonce -->
  <script nonce="${nonce}">
    document.getElementById('message').textContent =
      'This inline script ran because it carries a valid CSP nonce.';
  </script>
</body>
</html>`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// Endpoint to receive CSP violation reports
app.post(
  '/csp-violation-report',
  express.json({ type: ['application/csp-report', 'application/json'] }),
  (req, res) => {
    const report = req.body && (req.body['csp-report'] || req.body);
    console.warn('CSP Violation Report:', JSON.stringify(report, null, 2));
    res.status(204).end();
  }
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

module.exports = app;