const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// Helper function to HTML-encode strings to prevent XSS in server-rendered content
function encodeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, (m) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[m]));
}

// Middleware to set Content-Security-Policy (CSP) header
app.use((req, res, next) => {
    res.setHeader(
        'Content-Security-Policy', 
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
    );
    next();
});

// Mock database of items
const mockDatabase = [
    "Secure Coding Practices",
    "Understanding XSS and CSRF",
    "Node.js Security Best Practices",
    "Express.js Middleware Guide",
    "Web Application Firewalls",
    "OWASP Top Ten 2021"
];

// Search route
app.get('/search', (req, res) => {
    const query = req.query.q || '';
    
    // SECURITY: HTML-encode the query before echoing it back in any response
    const echoedQuery = encodeHTML(query);

    // Simple filter for mock results
    const filteredResults = mockDatabase.filter(item => 
        item.toLowerCase().includes(query.toLowerCase())
    );

    res.json({
        echoedQuery: echoedQuery,
        results: filteredResults
    });
});

// Serve the HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});