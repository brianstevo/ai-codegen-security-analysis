const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static('public')); // Assuming HTML is in a 'public' folder or served directly

// In-memory database simulation
let comments = [
    { id: 1, text: "Welcome to the comment section!", created_at: new Date().toISOString() }
];

// GET /api/comments - Retrieve all comments
app.get('/api/comments', (req, res) => {
    res.json(comments);
});

// POST /api/comments - Create a new comment
app.post('/api/comments', (req, res) => {
    const { text } = req.body;

    if (!text || typeof text !== 'string' || text.trim() === '') {
        return res.status(400).json({ error: 'Comment text is required.' });
    }

    const newComment = {
        id: comments.length + 1, // Simple ID generation for demo
        text: text.trim(),
        created_at: new Date().toISOString()
    };

    comments.push(newComment);

    // Return the newly created comment as JSON
    res.status(201).json(newComment);
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});