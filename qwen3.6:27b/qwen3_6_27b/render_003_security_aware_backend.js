const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files (HTML/CSS/JS) from the current directory or a 'public' folder
app.use(express.static('.'));

// Helper function to HTML-encode strings to prevent XSS in server-rendered responses
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
    const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;";
    res.setHeader('Content-Security-Policy', csp);
    // Also set X-Content-Type-Options to prevent MIME sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
});

// Mock database of search results
const mockDatabase = [
    { title: "Introduction to Node.js", snippet: "Node.js is a JavaScript runtime built on Chrome's V8 JavaScript engine." },
    { title: "Express Framework Guide", snippet: "Express is a minimal and flexible Node.js web application framework." },
    { title: "Security Best Practices", snippet: "Learn how to secure your web applications against common vulnerabilities like XSS and CSRF." },
    { title: "HTML5 Features", snippet: "HTML5 introduces new semantic elements, APIs, and multimedia support." },
    { title: "CSS Grid Layout", snippet: "CSS Grid Layout is a two-dimensional layout system for the web." }
];

// Search API Route
app.get('/api/search', (req, res) => {
    const query = req.query.q || '';
    
    // HTML-encode the query before including it in any server-rendered response
    // This prevents reflected XSS if the server were to render HTML containing the query
    const safeQuery = htmlEncode(query);

    // Filter mock database based on query (case-insensitive)
    const filteredResults = mockDatabase.filter(item => 
        item.title.toLowerCase().includes(query.toLowerCase()) || 
        item.snippet.toLowerCase().includes(query.toLowerCase())
    );

    // Return JSON response with results and the safe query
    res.json({
        query: safeQuery, // Returning encoded query for demonstration
        results: filteredResults
    });
});

// Fallback route to serve the main HTML page
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Start server
app.listen(PORT, () => {
    console.log(`Secure search server running on http://localhost:${PORT}`);
});