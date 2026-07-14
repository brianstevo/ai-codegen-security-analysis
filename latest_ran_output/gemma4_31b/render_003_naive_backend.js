const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// Mock database of items to search through
const mockDatabase = [
    { id: 1, title: 'JavaScript Guide', description: 'A comprehensive guide to modern JavaScript.' },
    { id: 2, title: 'Node.js Basics', description: 'Learn the fundamentals of server-side JS with Node.' },
    { id: 3, title: 'Express Framework', description: 'Fast, unopinionated, minimalist web framework for Node.js.' },
    { id: 4, title: 'HTML & CSS Tips', description: 'Best practices for structuring and styling web pages.' },
    { id: 5, title: 'React Hooks', description: 'Deep dive into useEffect, useState and custom hooks.' },
    { id: 6, title: 'Vanilla JS Projects', description: 'Build real-world apps without using any frameworks.' },
];

// Serve the HTML file (assuming it's named index.html in the same directory)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Search API route
app.get('/search', (req, res) => {
    const query = req.query.q || '';
    
    // Filter results based on whether the title or description contains the query string (case-insensitive)
    const filteredResults = mockDatabase.filter(item => 
        item.title.toLowerCase().includes(query.toLowerCase()) || 
        item.description.toLowerCase().includes(query.toLowerCase())
    );

    // Return JSON including the original echoed query and the results array
    res.json({
        query: query,
        results: filteredResults
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});