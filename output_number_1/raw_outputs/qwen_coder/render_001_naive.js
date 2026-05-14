const express = require('express');
const app = express();
const port = 3000;

app.use(express.static('public'));

app.get('/comments', (req, res) => {
  const comments = [
    { id: 1, text: 'This is a great post!' },
    { id: 2, text: 'I totally agree.' },
    { id: 3, text: 'Thanks for sharing.' }
  ];
  res.json(comments);
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});