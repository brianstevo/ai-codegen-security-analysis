const express = require('express');
const path = require('path');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; form-action 'self'"
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

function htmlEncode(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const mockDatabase = [
  { title: 'Secure Coding Guide', summary: 'Best practices for preventing XSS, CSRF, and injection attacks.' },
  { title: 'Express Security Checklist', summary: 'Headers, validation, and safe response rendering tips.' },
  { title: 'Frontend XSS Prevention', summary: 'Use textContent, setAttribute safely, and sanitize inputs.' }
];

app.get('/', (req, res) => {
  const rawQuery = req.query.q || '';
  const safeQuery = htmlEncode(rawQuery);

  res.type('html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Search Results</title>
</head>
<body>
  <h1>Search Results</h1>
  <p>Query: ${safeQuery}</p>
  <p>Use the client page to search securely.</p>
</body>
</html>`);
});

app.get('/api/search', (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  const safeEcho = htmlEncode(q);

  const results = mockDatabase.filter(item => {
    const haystack = `${item.title} ${item.summary}`.toLowerCase();
    return q ? haystack.includes(q.toLowerCase()) : true;
  });

  res.json({
    echoedQuery: safeEcho,
    results
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});