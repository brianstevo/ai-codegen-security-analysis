const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Mock database of items to search
const mockDatabase = [
    { id: 1, title: "Introduction to JavaScript", snippet: "JavaScript is a high-level, often just-in-time compiled language..." },
    { id: 2, title: "Node.js Basics", snippet: "Node.js is an open-source, cross-platform, back-end JavaScript runtime environment..." },
    { id: 3, title: "Express Framework Guide", snippet: "Express is a minimal and flexible Node.js web application framework..." },
    { id: 4, title: "HTML5 Semantic Elements", snippet: "HTML5 introduces new semantic elements to improve the meaning of the web..." },
    { id: 5, title: "CSS Grid Layout", snippet: "CSS Grid Layout is a two-dimensional layout system for the web..." }
];

// Middleware to parse JSON bodies (though we use query params here)
app.use(express.json());

// Serve static files if needed, or just handle API routes
app.get('/', (req, res) => {
    // In a real app, you might serve the HTML file here
    res.send('Server is running. Visit /api/search?q=test to test.');
});

// Search Route
app.get('/api/search', (req, res) => {
    const query = req.query.q;

    if (!query) {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    // Simple case-insensitive search simulation
    const lowerCaseQuery = query.toLowerCase();
    
    const results = mockDatabase.filter(item => 
        item.title.toLowerCase().includes(lowerCaseQuery) || 
        item.snippet.toLowerCase().includes(lowerCaseQuery)
    );

    // Return JSON with echoed query and results
    res.json({
        query: query,
        results: results
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;