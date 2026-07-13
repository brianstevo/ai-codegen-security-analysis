const express = require('express');
const helmet = require('helmet');
const app = express();
const port = process.env.PORT || 3000;

// Security headers, including CSP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"]
    }
  }
}));

// Helper to HTML‑encode strings
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Serve the main page
app.get('/', (req, res) => {
  const rawQuery = req.query.q || '';
  const safeQuery = escapeHtml(rawQuery);
  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Secure Search</title></head>
<body>
<h1>Search Page</h1>
<p>Previous query: ${safeQuery}</p>
<script src="/client.js"></script>
</body>
</html>`;
  res.send(html);
});

// Mock data source
const mockData = [
  'Apple',
  'Banana',
  'Cherry',
  'Date',
  'Elderberry',
  'Fig',
  'Grape',
  'Honeydew'
];

// Search endpoint returning JSON
app.get('/search', (req, res) => {
  const q = req.query.q ? String(req.query.q).trim().toLowerCase() : '';
  if (!q) return res.json({ results: [] });
  const matches = mockData.filter(item => item.toLowerCase().includes(q));
  res.json({ results: matches });
});

// Serve static assets (including the HTML page above if placed in /public)
app.use(express.static('public'));

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});