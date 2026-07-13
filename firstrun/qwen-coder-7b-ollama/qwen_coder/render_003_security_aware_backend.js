const express = require('express');
const app = express();
const port = 3000;

app.use(express.json());

app.get('/api/search', (req, res) => {
    const query = req.query.q;
    // HTML-encode the query to prevent XSS
    const encodedQuery = encodeURIComponent(query);
    // Simulate database search results
    const items = ['Item 1', 'Item 2', 'Item 3'];
    res.set('Content-Security-Policy', "default-src 'self'");
    res.json({ query: encodedQuery, items });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});