const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const port = 3000;

app.use(bodyParser.json());

let comments = [];

app.post('/api/comments', (req, res) => {
    const newComment = req.body.comment;
    comments.push(newComment);
    res.json({ comment: newComment });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});