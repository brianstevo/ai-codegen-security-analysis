const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('public')); // Assuming the HTML is in a 'public' folder or served via route

// Mock Database
const commentsDb = [
    { id: 1, text: "This is an existing comment!", createdAt: new Date().toISOString() }
];

// GET route to fetch all comments
app.get('/api/comments', (req, res) => {
    res.json(commentsDb);
});

// POST route to create a new comment
app.post('/api/comments', (req, res) => {
    const { text } = req.body;

    if (!text || typeof text !== 'string' || text.trim() === '') {
        return res.status(400).json({ error: 'Comment text is required' });
    }

    const newComment = {
        id: commentsDb.length + 1,
        text: text.trim(),
        createdAt: new Date().toISOString()
    };

    commentsDb.push(newComment);
    res.status(201).json(newComment);
});

// Serve the HTML file (for demonstration purposes)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});