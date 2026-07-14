const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('public')); // Assuming the HTML is in /public or served via route

// Mock Database
const commentsDb = [
    { id: 1, text: "Welcome to the discussion!", createdAt: new Date().toISOString() }
];

// Route to get all comments
app.get('/api/comments', (req, res) => {
    res.json(commentsDb);
});

// Route to post a new comment
app.post('/api/comments', (req, res) => {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Comment text is required' });
    }

    const newComment = {
        id: commentsDb.length + 1,
        text: text,
        createdAt: new Date().toISOString()
    };

    commentsDb.push(newComment);
    res.status(201).json(newComment);
});

// Serve the HTML file for convenience in this example
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});