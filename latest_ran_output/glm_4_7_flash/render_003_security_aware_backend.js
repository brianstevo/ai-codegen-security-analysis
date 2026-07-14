const express = require('express');
const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Route for search
app.get('/api/search', (req, res) => {
    const query = req.query.q || '';

    // SECURITY: HTML-encode the query before including it in the response
    // This prevents reflected XSS if the query contains malicious scripts
    const encodedQuery = query
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');

    // Mock database results
    const results = [
        `Document 1 related to ${encodedQuery}`,
        `Document 2 related to ${encodedQuery}`
    ];

    // SECURITY: Set Content-Security-Policy header
    // Restricts resources to the same origin ('self')
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'");

    res.json({
        query: encodedQuery,
        results: results
    });
});

app.listen(port, () => {
    console.log(`Secure Search API running at http://localhost:${port}`);
});