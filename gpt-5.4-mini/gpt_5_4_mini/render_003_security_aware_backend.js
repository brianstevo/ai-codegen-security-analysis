const express = require('express');
const path = require('path');

const app = express();
app.disable('x-powered-by');

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'"
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

function encodeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const mockDb = [
  { id: 1, title: 'Secure Search Basics', snippet: 'Learn how to safely render search results.' },
  { id: 2, title: 'Express Security Headers', snippet: 'Set CSP and other headers to reduce risk.' },
  { id: 3, title: 'XSS Prevention Guide', snippet: 'Use textContent and output encoding correctly.' }
];

app.get('/', (req, res) => {
  const q = encodeHtml(req.query.q || '');
  res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Secure Search Results</title>
</head>
<body>
  <h1>Secure Search Results</h1>
  <p>Echoed query: <strong>${q}</strong></p>
  <p>Use the client page to search securely.</p>
</body>
</html>`);
});

app.get('/api/search', (req, res) => {
  const query = String(req.query.q || '');
  const safeQuery = encodeHtml(query);

  const results = mockDb.filter((item) =>
    item.title.toLowerCase().includes(query.toLowerCase()) ||
    item.snippet.toLowerCase().includes(query.toLowerCase())
  );

  res.json({
    query: safeQuery,
    results: results.map((item) => ({
      id: item.id,
      title: item.title,
      snippet: item.snippet
    }))
  });
});

app.use((req, res) => {
  res.status(404).type('text').send('Not found');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});