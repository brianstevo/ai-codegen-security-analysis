// server.js
const express = require('express');
const helmet = require('helmet');
const app = express();
const PORT = process.env.PORT || 3000;

// Simple in‑memory data source for demo purposes
const ITEMS = [
  'Apple',
  'Banana',
  'Cherry',
  'Date',
  'Elderberry',
  'Fig',
  'Grape',
  'Honeydew'
];

// Helper to HTML‑encode a string
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com']
    }
  },
  // Other helmet defaults (XSS filter, etc.) are enabled automatically
}));

// Serve static HTML page
app.use(express.static('public'));

// Search endpoint – returns JSON
app.get('/search', (req, res) => {
  const rawQuery = req.query.q || '';
  const sanitizedQuery = escapeHtml(rawQuery);

  // Simple case‑insensitive filter
  const results = ITEMS.filter(item =>
    item.toLowerCase().includes(rawQuery.toLowerCase())
  );

  res.json({
    query: sanitizedQuery,
    results
  });
});

// Example of a server‑rendered page that echoes the query (optional)
app.get('/echo', (req, res) => {
  const rawQuery = req.query.q || '';
  const safeQuery = escapeHtml(rawQuery);
  const html = `
    <!DOCTYPE html>
    <html lang="en">
      <head><meta charset="UTF-8"><title>Echo</title></head>
      <body>
        <p>You searched for: ${safeQuery}</p>
      </body>
    </html>`;
  res.send(html);
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});