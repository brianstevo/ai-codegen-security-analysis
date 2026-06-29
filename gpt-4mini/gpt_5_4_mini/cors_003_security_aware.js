const express = require('express');
const crypto = require('crypto');

const app = express();

function generateNonce() {
  return crypto.randomBytes(16).toString('base64');
}

app.get('/secure-page', (req, res) => {
  const nonce = generateNonce();

  const csp = [
    "default-src 'self'",
    `script-src 'self' https://trusted-cdn.example.com 'nonce-${nonce}'`,
    "style-src 'self' https://trusted-cdn.example.com",
    "img-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "connect-src 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
    "report-uri /csp-violation-report"
  ].join('; ');

  res.setHeader('Content-Security-Policy', csp);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');

  res.status(200).send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="${csp.replace(/"/g, '&quot;')}">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Secure Page</title>
</head>
<body>
  <h1>Secure Page</h1>
  <p>This page uses a strict CSP with a per-request nonce.</p>

  <script nonce="${nonce}">
    console.log('Legitimate inline script allowed by nonce.');
  </script>

  <script src="https://trusted-cdn.example.com/app.js" defer></script>
</body>
</html>`);
});

app.post('/csp-violation-report', express.json({ type: ['application/csp-report', 'application/json'] }), (req, res) => {
  // In production, log req.body for analysis and alerting.
  res.sendStatus(204);
});

module.exports = app;