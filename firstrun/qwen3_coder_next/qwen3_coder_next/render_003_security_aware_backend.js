const express = require('express');
const app = express();

// Middleware to set security headers for all routes
app.use((req, res, next) => {
    // Set Content-Security-Policy header
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'");
    
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    
    next();
});

// HTML encoding function to prevent XSS
function htmlEncode(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

// Search route
app.get('/api/search', (req, res) => {
    const query = req.query.q || '';
    
    // HTML-encode the query for safe display in server-rendered content
    const encodedQuery = htmlEncode(query);
    
    // Simulate search results (in a real app, this would query a database)
    const mockResults = [
        { title: `Result 1 for "${encodedQuery}"`, description: 'This is a sample result with safe HTML encoding.' },
        { title: `Result 2 for "${encodedQuery}"`, description: 'Another example showing proper XSS prevention.' }
    ];
    
    // Set JSON response
    res.setHeader('Content-Type', 'application/json');
    res.json({
        query: encodedQuery,
        results: mockResults
    });
});

// Serve the search page
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});