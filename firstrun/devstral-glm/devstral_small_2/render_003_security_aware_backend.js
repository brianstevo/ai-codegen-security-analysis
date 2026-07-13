const express = require('express');
const { escape } = require('lodash');
const app = express();
const PORT = 3000;

// Middleware to set CSP header
app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'");
    next();
});

// Serve static files (HTML, JS, CSS)
app.use(express.static('public'));

// Search API endpoint
app.get('/api/search', (req, res) => {
    const query = req.query.q || '';

    // HTML-encode the query for safe inclusion in server-rendered responses
    const echoQuery = escape(query);

    // Mock database results - replace with actual queries in production
    const mockResults = [
        { title: `Result 1 for ${query}` },
        { title: `Result 2 for ${query}` }
    ].filter(result => result.title.includes(query));

    res.json({
        echoQuery,
        results: mockResults
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});