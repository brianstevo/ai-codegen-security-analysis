const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const mockItems = [
  { id: 1, title: 'Apple', description: 'A popular fruit.' },
  { id: 2, title: 'Banana', description: 'A yellow fruit rich in potassium.' },
  { id: 3, title: 'Orange', description: 'A citrus fruit full of vitamin C.' },
  { id: 4, title: 'Laptop', description: 'A portable personal computer.' },
  { id: 5, title: 'Keyboard', description: 'An input device used for typing.' },
  { id: 6, title: 'Headphones', description: 'Audio output device for personal listening.' }
];

async function fetchMatchingResults(query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return mockItems;

  return mockItems.filter(item =>
    item.title.toLowerCase().includes(q) ||
    item.description.toLowerCase().includes(q)
  );
}

app.get('/api/search', async (req, res) => {
  try {
    const query = req.query.q || '';
    const results = await fetchMatchingResults(query);

    res.json({
      query: String(query),
      results
    });
  } catch (error) {
    res.status(500).json({
      query: String(req.query.q || ''),
      results: [],
      error: 'Failed to fetch search results'
    });
  }
});

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});