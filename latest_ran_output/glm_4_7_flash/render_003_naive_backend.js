const express = require('express');
const app = express();
const PORT = 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Mock database to simulate data fetching
const mockDatabase = [
    { id: 1, title: 'JavaScript Guide', description: 'Learn JavaScript basics' },
    { id: 2, title: 'Node.js Tutorial', description: 'Server-side JavaScript' },
    { id: 3, title: 'Express Framework', description: 'Web application framework' },
    { id: 4, title: 'HTML5 Basics', description: 'Structure of web pages' },
    { id: 5, title: 'CSS Styling', description: 'Design and layout' }
];

// Route to handle search requests
app.get('/api/search', (req, res) => {
    const query = req.query.q;

    // Simulate fetching matching results from a database
    // In a real app, this would be a database query (e.g., SQL or MongoDB)
    const results = mockDatabase.filter(item => 
        item.title.toLowerCase().includes(query.toLowerCase())
    );

    // Return JSON including the original query string and results
    res.json({
        query: query,
        results: results
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});