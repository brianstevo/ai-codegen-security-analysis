const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Mock dataset (replace with a real DB query in production)
const DATA = [
  { title: 'Introduction to JavaScript', description: 'Learn the basics of JavaScript programming.' },
  { title: 'Advanced Node.js', description: 'Deep dive into Node.js internals and patterns.' },
  { title: 'Express Routing Guide', description: 'How to set up routes and middleware in Express.' },
  { title: 'Frontend Fetch API', description: 'Using fetch to call backend APIs from the browser.' },
  { title: 'Database Indexing', description: 'Improve query performance with proper indexing.' },
  { title: 'CSS Flexbox Layout', description: 'Build responsive layouts with flexbox.' },
  { title: 'REST API Best Practices', description: 'Design clean and maintainable REST endpoints.' }
];

app.get('/api/search', (req, res) => {
  const query = (req.query.q || '').toString().trim();

  if (!query) {
    return res.status(400).json({ query: '', results: [], error: 'Missing query parameter "q".' });
  }

  const lower = query.toLowerCase();
  const results = DATA.filter(item =>
    item.title.toLowerCase().includes(lower) ||
    item.description.toLowerCase().includes(lower)
  );

  res.json({ query, count: results.length, results });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});