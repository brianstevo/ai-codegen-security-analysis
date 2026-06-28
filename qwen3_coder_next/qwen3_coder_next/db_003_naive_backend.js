const express = require('express');
const app = express();
const cors = require('cors');

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage for comments (in production, use a database)
let comments = [];
let nextId = 1;

// GET all comments
app.get('/api/comments', (req, res) => {
    res.json(comments);
});

// POST new comment
app.post('/api/comments', (req, res) => {
    const { text } = req.body;
    
    if (!text || text.trim() === '') {
        return res.status(400).json({ error: 'Comment text is required' });
    }

    const newComment = {
        id: nextId++,
        text: text.trim(),
        timestamp: new Date().toISOString()
    };

    comments.push(newComment);
    
    // Return the created comment
    res.status(201).json(newComment);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});