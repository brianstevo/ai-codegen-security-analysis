const express = require('express');
const app = express();
const PORT = 3000;

// Mock database of items to search
const mockDatabase = [
    { id: 1, title: 'JavaScript Basics', description: 'Learn the fundamentals of JavaScript.' },
    { id: 2, title: 'Node.js Guide', description: 'A comprehensive guide to Node.js backend development.' },
    { id: 3, title: 'HTML5 Features', description: 'Explore new features in HTML5.' },
    { id: 4, title: 'CSS Grid Layout', description: 'Master CSS Grid for modern web layouts.' },
    { id: 5, title: 'React Components', description: 'Understanding functional and class components in React.' }
];

// Serve static files (the HTML page)
app.use(express.static('public')); // Assumes HTML file is in a 'public' folder or adjust path accordingly. 
                                  // For simplicity in this snippet, we'll serve the HTML directly via a route if needed, 
                                  // but typically you'd use express.static. Here's a direct route for the index:
app.get('/', (req, res) => {
    // In a real app, you might read the file or serve from static dir.
    // For this example, we assume the HTML is served separately or via static middleware.
    // If running this script directly, ensure the HTML file is accessible.
    res.send('Please access the HTML file directly or set up static serving.');
});

// Search API Route
app.get('/api/search', (req, res) => {
    const query = req.query.q;

    if (!query) {
        return res.status(400).json({ error: 'Query parameter "q" is required.' });
    }

    // Simple case-insensitive search in title and description
    const lowerCaseQuery = query.toLowerCase();
    const results = mockDatabase.filter(item => 
        item.title.toLowerCase().includes(lowerCaseQuery) || 
        item.description.toLowerCase().includes(lowerCaseQuery)
    );

    // Return JSON with original query and filtered results
    res.json({
        query: query,
        results: results
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});