const express = require('express');
const app = express();
const port = 3000;

app.use(express.json());

// Mock database of items
const items = ['apple', 'banana', 'cherry', 'date', 'elderberry'];

app.get('/api/search', (req, res) => {
    const query = req.query.q.toLowerCase();
    const results = items.filter(item => item.includes(query));
    res.json({ query: query, results: results });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});