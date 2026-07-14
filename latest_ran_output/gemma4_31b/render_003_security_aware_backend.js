const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// Mock database
const DATABASE = [
    "Apple iPhone 15",
    "Samsung Galaxy S23",
    "Google Pixel 8",
    "Sony WH-1000XM5 Headphones",
    "MacBook Pro M3",
    "Dell XPS 15",
    "Nintendo Switch OLED"
];

/**
 * Helper to HTML-encode strings.
 * Prevents XSS if the server were to render the query directly into an HTML template.
 */
function encodeHTML(str) {
    if (!str) return "";
    return str.replace(/[&<>"']/g, function(m) {
        switch (m) {
            case '&': return '&amp;';
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '"': return '&quot;';
            case "'": return '&#39;';
            default: return m;
        }
    });
}

// Middleware to set Content-Security-Policy (CSP)
app.use((req, res, next) => {
    res.setHeader(
        'Content-Security-Policy', 
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
    );
    next();
});

// Serve the HTML page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Search API Route
app.get('/search', (req, res) => {
    const query = req.query.q || "";
    
    // Server-side encoding of the echoed query as requested
    const safeEcho = encodeHTML(query);
    
    // Simple filter logic
    const results = DATABASE.filter(item => 
        item.toLowerCase().includes(query.toLowerCase())
    );

    res.json({
        echo: safeEcho,
        results: results
    });
});

app.listen(PORT, () => {
    console.log(`Secure search server running at http://localhost:${PORT}`);
});