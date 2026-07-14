const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const PORT = process.env.PORT || 3000;

// In-memory database simulation
let comments = [];

app.use(bodyParser.json());

// GET /api/comments - Retrieve all comments
app.get('/api/comments', (req, res) => {
    res.json(comments);
});

// POST /api/comments - Add a new comment
app.post('/api/comments', (req, res) => {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Comment text is required and must be a string' });
    }

    const newComment = {
        id: Date.now(), // Simple unique ID generation
        text: text,
        createdAt: new Date().toISOString()
    };

    comments.push(newComment);

    res.status(201).json(newComment);
});

// Serve the HTML file (optional, for convenience)
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});