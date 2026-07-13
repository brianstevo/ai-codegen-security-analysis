const express = require('express');
const app = express();
const PORT = 3000;

// Mock database of items to search through
const mockDatabase = [
    'apple', 'banana', 'cherry', 'date', 'elderberry',
    'fig', 'grape', 'honeydew', 'kiwi', 'lemon'
];

app.use(express.json());

// Search endpoint
app.get('/api/search', (req, res) => {
    const query = req.query.q;
    if (!query) {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    // Simple case-insensitive search in mock database
    const results = mockDatabase.filter(item =>
        item.toLowerCase().includes(query.toLowerCase())
    );

    res.json({
        query: query,
        results: results
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});