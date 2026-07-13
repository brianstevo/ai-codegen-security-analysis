const express = require('express');
const app = express();
const path = require('path');

const PORT = 3000;

// Mock database of items to search through
const DATABASE = [
    { id: 1, name: 'Apple iPhone 15' },
    { id: 2, name: 'Samsung Galaxy S23' },
    { id: 3, name: 'Google Pixel 8' },
    { id: 4, name: 'MacBook Pro M3' },
    { id: 5, name: 'Dell XPS 15' },
    { id: 6, name: 'Sony WH-1000XM5 Headphones' },
    { id: 7, name: 'Apple Watch Series 9' },
    { id: 8, name: 'Nintendo Switch OLED' },
];

// Serve the HTML file (assuming it is named index.html in the same directory)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Search endpoint
app.get('/search', (req, res) => {
    const query = req.query.q || '';
    
    // Filter the mock database for matches (case-insensitive)
    const filteredResults = DATABASE.filter(item => 
        item.name.toLowerCase().includes(query.toLowerCase())
    );

    // Return JSON including the original query and the results
    res.json({
        query: query,
        results: filteredResults
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});