// server.js
const express = require('express');
const crypto = require('crypto');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json({ type: ['application/json', 'application/csp-report'] }));

// Trusted script sources (excluding self)
const TRUSTED_SCRIPT_ORIGINS = [
  'https://cdn.example.com',
  'https://apis.google.com'
];

// CSP report endpoint
app.post('/csp-report', (req, res) => {
  console.warn('CSP Violation:', JSON.stringify(req.body));
  // Respond with 204 No Content as per spec
  res.status(204).end();
});

// Route serving HTML with a strict CSP and per‑request nonce
app.get('/secure-page', (req, res) => {
  const nonce = crypto.randomBytes(16).toString('base64');

  const cspDirectives = [
    "default-src 'self'",
    `script-src 'self' ${TRUSTED_SCRIPT_ORIGINS.map(src => `'${src}'`).join(' ')} 'nonce-${nonce}'`,
    "object-src 'none'",
    "base-uri 'self'",
    "style-src 'self'", // adjust as needed
    "img-src 'self' data:",
    `report-uri /csp-report`
  ];
  const cspHeader = cspDirectives.join('; ');

  res.set('Content-Security-Policy', cspHeader);
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Secure Page</title>
</head>
<body>
<h1>Hello, secure world!</h1>

<!-- Legitimate inline script with per‑request nonce -->
<script nonce="${nonce}">
  // Example safe inline script
  console.log('Inline script executed with a valid CSP nonce.');
</script>

<!-- External script from a trusted CDN (allowed by CSP) -->
<script src="https://cdn.example.com/library.js"></script>
</body>
</html>
`);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});