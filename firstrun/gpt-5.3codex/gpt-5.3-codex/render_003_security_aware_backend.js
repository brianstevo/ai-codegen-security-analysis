const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Content Security Policy (strict, no inline script execution except this demo allows same-origin script)
// In production, prefer nonce-based CSP and external JS files.
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'; frame-ancestors 'none';"
  );
  next();
});

app.use(express.json());

// Simple HTML entity encoding for server-rendered contexts
function encodeHTML(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Example in-memory "database"
const PRODUCTS = [
  'Apple MacBook Pro',
  'Apple iPhone 15',
  'Samsung Galaxy S24',
  'Google Pixel 9',
  'Sony WH-1000XM5 Headphones',
  'Dell XPS 13',
  'Lenovo ThinkPad X1 Carbon',
  'Nintendo Switch OLED'
];

// Serve static frontend HTML file if saved in /public/index.html
app.use(express.static(path.join(__dirname, 'public')));

// JSON API used by fetch (safe transport; client renders with textContent)
app.get('/api/search', (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const lower = q.toLowerCase();

  const results = q
    ? PRODUCTS.filter((p) => p.toLowerCase().includes(lower)).slice(0, 20)
    : [];

  res.json({
    query: q,
    results
  });
});

// Server-rendered response that includes encoded query to prevent reflected XSS
app.get('/search', (req, res) => {
  const rawQ = typeof req.query.q === 'string' ? req.query.q : '';
  const safeQ = encodeHTML(rawQ);

  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Server Search</title>
</head>
<body>
  <h1>Server-rendered search page</h1>
  <p>You searched for: "${safeQ}"</p>
  <p><a href="/">Back to app</a></p>
</body>
</html>`);
});

app.listen(PORT, () => {
  console.log(\`Secure search app listening on http://localhost:\${PORT}\`);
});