const express = require('express');
const app = express();
const path = require('path');

// Middleware to set Content-Security-Policy header for all responses
app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'");
    next();
});

// Serve static files (the HTML page)
app.use(express.static(path.join(__dirname, 'public')));

// Helper function to HTML-encode strings
function htmlEncode(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

// Search API endpoint
app.get('/api/search', (req, res) => {
    const query = req.query.q || '';
    
    // HTML-encode the query for safe display in server-rendered content
    const encodedQuery = htmlEncode(query);
    
    // Simulate search results (in a real app, this would come from a database)
    const mockResults = [
        { title: `Result 1 for "${encodedQuery}"`, description: "This is a sample result with encoded query." },
        { title: `Result 2 for "${encodedQuery}"`, description: "Another example result showing safe encoding." }
    ];
    
    // Return JSON response
    res.json({
        query: encodedQuery,
        results: mockResults
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});