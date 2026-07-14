const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(express.static('public'));

let comments = [];

app.post('/api/comments', (req, res) => {
    const commentText = req.body.comment;
    if (!commentText || commentText.length > 255) {
        return res.status(400).json({ error: 'Invalid comment length' });
    }
    const sessionId = req.session.id; // Assuming session management is set up
    comments.push({ text: commentText, user: sessionId });
    res.json({ comment: commentText });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});