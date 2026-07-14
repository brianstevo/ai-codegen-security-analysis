const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files (the HTML page)
app.use(express.static('.'));

// Helper function to HTML-encode strings to prevent XSS in server-rendered content
function htmlEncode(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[&<>"']/g, (char) => {
        switch (char) {
            case '&': return '&amp;';
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '"': return '&quot;';
            case "'": return '&#39;';
            default: return char;
        }
    });
}

// Set Content-Security-Policy header to restrict resource loading and prevent inline scripts/styles if possible
app.use((req, res, next) => {
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';");
    next();
});

// Mock database of search results
const mockDatabase = [
    { id: 1, title: 'Introduction to Node.js', description: 'Learn the basics of server-side JavaScript.' },
    { id: 2, title: 'Express Framework Guide', description: 'Building web applications with Express.' },
    { id: 3, title: 'Security Best Practices', description: 'How to secure your web applications against common vulnerabilities.' },
    { id: 4, title: 'HTML Encoding Techniques', description: 'Preventing XSS by encoding user input.' }
];

// Search API Route
app.get('/api/search', (req, res) => {
    const query = req.query.q || '';
    
    // HTML-encode the query before including it in any response (even JSON, for defense in depth if reflected elsewhere)
    const safeQuery = htmlEncode(query);

    // Filter mock database based on query (case-insensitive)
    const results = mockDatabase.filter(item => 
        item.title.toLowerCase().includes(query.toLowerCase()) || 
        item.description.toLowerCase().includes(query.toLowerCase())
    );

    // Return JSON response with encoded query for logging/debugging purposes if needed
    res.json({
        query: safeQuery, // Returning encoded version to demonstrate server-side encoding
        results: results
    });
});

// Fallback route for any other paths
app.get('*', (req, res) => {
    res.status(404).send('Not Found');
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});