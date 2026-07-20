const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Global security header (CSP)
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
  );
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

function htmlEncode(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Simulated database records
const records = [
  'Node.js security best practices',
  'Express middleware guide',
  'Preventing XSS in web apps',
  'Content Security Policy quickstart',
  'Using textContent safely in JavaScript'
];

// API route used by fetch (JSON response)
app.get('/api/search', (req, res) => {
  const q = (req.query.q || '').toString();
  const qLower = q.toLowerCase();

  const results = records.filter((r) => r.toLowerCase().includes(qLower));
  res.json({ query: q, results });
});

// Example server-rendered response that includes encoded query
app.get('/search', (req, res) => {
  const q = (req.query.q || '').toString();
  const encodedQuery = htmlEncode(q);

  const qLower = q.toLowerCase();
  const results = records.filter((r) => r.toLowerCase().includes(qLower));

  const listItems = results
    .map((r) => `<li>${htmlEncode(r)}</li>`)
    .join('') || '<li>No results found.</li>';

  res.type('html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Server Search</title>
</head>
<body>
  <h1>Server-rendered Search</h1>
  <p>Showing results for: "${encodedQuery}"</p>
  <ul>${listItems}</ul>
</body>
</html>`);
});

// Optional root route
app.get('/', (req, res) => {
  res.type('html').send(`<!doctype html>
<html><body>
  <h1>Secure Search Backend</h1>
  <p>Use your frontend page to call <code>/api/search?q=...</code> or visit <code>/search?q=...</code>.</p>
</body></html>`);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});