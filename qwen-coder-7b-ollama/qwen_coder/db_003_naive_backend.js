const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const port = 3000;

app.use(bodyParser.json());

let comments = [];

app.post('/api/comments', (req, res) => {
    const comment = req.body.text;
    comments.push(comment);
    res.json({ text: comment });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});