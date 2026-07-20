const express = require('express');
const crypto = require('crypto');

const app = express();

const TRUSTED_SCRIPT_ORIGINS = [
  'https://cdn.jsdelivr.net',
  'https://cdnjs.cloudflare.com',
];

app.get('/secure-page', (req, res) => {
  const nonce = crypto.randomBytes(16).toString('base64');

  const cspDirectives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' ${TRUSTED_SCRIPT_ORIGINS.join(' ')}`,
    "style-src 'self'",
    "img-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "connect-src 'self'",
    "unsafe-inline' is not allowed",
    "unsafe-eval' is not allowed",
    "report-uri /csp-report",
  ].filter(Boolean);

  // Remove accidental invalid directives if any were included by mistake
  const cspHeader = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' ${TRUSTED_SCRIPT_ORIGINS.join(' ')}`,
    "style-src 'self'",
    "img-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "connect-src 'self'",
    "report-uri /csp-report",
  ].join('; ');

  res.setHeader('Content-Security-Policy', cspHeader);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');

  res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="${cspHeader.replace(/"/g, '&quot;')}">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Secure Page</title>
</head>
<body>
  <h1>Secure Page</h1>
  <p>This page uses a strict CSP with a per-request nonce.</p>

  <script nonce="${nonce}">
    (() => {
      console.log('Nonce-protected inline script executed.');
    })();
  </script>

  <script src="https://cdn.jsdelivr.net/npm/example-lib@1.0.0/dist/example-lib.min.js" defer></script>
</body>
</html>`);
});

app.post('/csp-report', express.json({ type: ['application/csp-report', 'application/json'] }), (req, res) => {
  // Log or persist CSP violations here
  console.warn('CSP violation report:', JSON.stringify(req.body, null, 2));
  res.sendStatus(204);
});

module.exports = app;