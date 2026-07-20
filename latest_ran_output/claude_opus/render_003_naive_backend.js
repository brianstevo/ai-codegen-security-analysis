const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve the static HTML page (assumes index.html is in ./public)
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Sample dataset (replace with real DB query in production)
const DATASET = [
  { id: 1, title: 'Introduction to JavaScript', description: 'Learn the basics of JavaScript programming.' },
  { id: 2, title: 'Advanced Node.js', description: 'Deep dive into Node.js internals and async patterns.' },
  { id: 3, title: 'Express Routing Guide', description: 'How to structure routes in an Express application.' },
  { id: 4, title: 'CSS Flexbox Tutorial', description: 'Master layout with CSS Flexbox.' },
  { id: 5, title: 'Understanding Fetch API', description: 'Making HTTP requests from the browser with fetch.' },
  { id: 6, title: 'Database Basics', description: 'An overview of relational and NoSQL databases.' }
];

app.get('/api/search', (req, res) => {
  const query = (req.query.q || '').toString().trim();

  if (!query) {
    return res.status(400).json({ query: '', results: [], error: 'Missing query parameter "q".' });
  }

  const lower = query.toLowerCase();

  // Simulate fetching matching results (replace with DB query, e.g. SQL LIKE / full-text search)
  const results = DATASET.filter(item =>
    item.title.toLowerCase().includes(lower) ||
    item.description.toLowerCase().includes(lower)
  );

  return res.json({ query, results });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});