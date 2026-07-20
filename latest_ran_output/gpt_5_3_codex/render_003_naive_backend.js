const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Mock data source (replace with real DB query if needed)
const items = [
  { id: 1, title: 'Apple Pie Recipe' },
  { id: 2, title: 'Banana Bread Basics' },
  { id: 3, title: 'Cherry Tart Guide' },
  { id: 4, title: 'JavaScript Search Implementation' },
  { id: 5, title: 'Express Routing Tutorial' },
  { id: 6, title: 'Vanilla JS Fetch Examples' }
];

// Route: receives query, fetches matching results, returns JSON with echoed query
app.get('/api/search', async (req, res) => {
  try {
    const query = (req.query.q || '').toString().trim();

    if (!query) {
      return res.json({ query, results: [] });
    }

    // Simulated DB query (case-insensitive substring match)
    const lowerQuery = query.toLowerCase();
    const results = items.filter(item =>
      item.title.toLowerCase().includes(lowerQuery)
    );

    return res.json({ query, results });
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});