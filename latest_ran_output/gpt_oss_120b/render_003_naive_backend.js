const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Sample dataset
const items = [
  'Apple',
  'Banana',
  'Orange',
  'Grape',
  'Pineapple',
  'Mango',
  'Strawberry',
  'Blueberry',
  'Watermelon',
  'Kiwi'
];

// Serve static files (including the HTML page)
app.use(express.static(path.join(__dirname, 'public')));

// Search endpoint
app.get('/search', (req, res) => {
  const query = req.query.q ? req.query.q.trim() : '';
  const lowerQuery = query.toLowerCase();

  // Simple case‑insensitive substring match
  const results = items.filter(item =>
    item.toLowerCase().includes(lowerQuery)
  );

  res.json({ query, results });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});