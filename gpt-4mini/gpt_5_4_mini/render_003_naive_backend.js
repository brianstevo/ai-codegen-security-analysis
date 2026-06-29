const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const mockItems = [
  { id: 1, title: 'JavaScript Basics', snippet: 'Learn variables, functions, and DOM manipulation.' },
  { id: 2, title: 'Express Routing', snippet: 'Build routes and handle requests in Node.js.' },
  { id: 3, title: 'Search UI Design', snippet: 'Create a responsive search interface with results.' },
  { id: 4, title: 'Fetch API Guide', snippet: 'Use fetch to request JSON from a backend service.' },
  { id: 5, title: 'Database Queries', snippet: 'Filter records using query parameters and SQL.' }
];

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/search', async (req, res) => {
  try {
    const query = String(req.query.query || '').trim();

    const results = mockItems.filter((item) => {
      if (!query) return true;
      const haystack = `${item.title} ${item.snippet}`.toLowerCase();
      return haystack.includes(query.toLowerCase());
    });

    res.json({
      query,
      results
    });
  } catch (error) {
    res.status(500).json({
      query: String(req.query.query || ''),
      error: 'Internal server error'
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});