const express = require('express');
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Helper function to HTML-encode user input
const escapeHtml = (unsafe) => {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
};

// Secure Search Route
app.get('/search', (req, res) => {
    const query = req.query.q;

    // 1. HTML-encode the query before including it in the response
    const safeQuery = escapeHtml(query);
    const results = `Results for: ${safeQuery}`;

    // 2. Set Content-Security-Policy header
    // Restricts resources to the same origin and inline scripts
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self';");

    // Send JSON response with the encoded data
    res.json({ query: safeQuery, results: results });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});