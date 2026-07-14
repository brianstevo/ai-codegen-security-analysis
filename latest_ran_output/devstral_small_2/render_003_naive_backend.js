const express = require('express');
const app = express();
const PORT = 3000;

// Mock database of items to search through
const mockDatabase = [
    'Apple', 'Banana', 'Cherry', 'Date', 'Elderberry',
    'Fig', 'Grape', 'Honeydew', 'Kiwi', 'Lemon'
];

app.use(express.json());

// Search endpoint
app.get('/api/search', (req, res) => {
    const query = req.query.q;
    if (!query) {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    // Simple case-insensitive search
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