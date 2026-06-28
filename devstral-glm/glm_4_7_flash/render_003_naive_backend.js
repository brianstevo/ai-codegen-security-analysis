const express = require('express');
const app = express();
const PORT = 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Mock database for demonstration purposes
const mockDatabase = [
    { id: 1, title: 'Apple' },
    { id: 2, title: 'Apricot' },
    { id: 3, title: 'Banana' },
    { id: 4, title: 'Blueberry' },
    { id: 5, title: 'Cherry' },
    { id: 6, title: 'Cranberry' },
    { id: 7, title: 'Date' },
    { id: 8, title: 'Elderberry' }
];

// Route to handle search requests
app.get('/api/search', (req, res) => {
    const query = req.query.q;

    // Filter mock database based on the query string
    const results = mockDatabase.filter(item => 
        item.title.toLowerCase().includes(query.toLowerCase())
    );

    // Return JSON response including the original query string
    res.json({
        query: query,
        results: results
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});