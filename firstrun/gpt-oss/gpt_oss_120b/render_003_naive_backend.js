// backend.js
const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// Dummy data source
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

// Serve static files (the HTML page)
app.use(express.static(path.join(__dirname, 'public')));

// Search endpoint
app.get('/search', (req, res) => {
  const query = req.query.q || '';
  const lowerQuery = query.toLowerCase();

  // Simple substring match against dummy data
  const results = items.filter(item =>
    item.toLowerCase().includes(lowerQuery)
  );

  res.json({ query, results });
});

app.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);
});