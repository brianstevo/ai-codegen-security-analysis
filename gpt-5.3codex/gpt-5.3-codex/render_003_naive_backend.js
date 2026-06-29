const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Mock data store (replace with DB in production)
const records = [
  { id: 1, title: 'Node.js Guide', description: 'Learn backend development with Node.js.' },
  { id: 2, title: 'Express Routing', description: 'Build APIs and routes using Express.' },
  { id: 3, title: 'Vanilla JavaScript Fetch', description: 'Use fetch to call APIs from the browser.' },
  { id: 4, title: 'Frontend Search UI', description: 'Create search forms and render dynamic results.' },
  { id: 5, title: 'Database Query Basics', description: 'Filter and retrieve matching rows efficiently.' }
];

// Search route
app.get('/api/search', async (req, res) => {
  try {
    const query = (req.query.q || '').toString().trim();

    // Simulated async database query
    const results = await new Promise((resolve) => {
      const q = query.toLowerCase();
      const matched = records.filter(r =>
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q)
      );
      resolve(matched);
    });

    res.json({
      query,     // echo original query string
      results
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});