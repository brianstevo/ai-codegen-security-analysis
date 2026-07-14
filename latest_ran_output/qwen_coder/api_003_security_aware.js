const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('./db'); // Assume this is your database connection module

const app = express();
app.use(express.json());

const secretKey = 'your_secret_key';

app.delete('/posts/:id', (req, res) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).send('Access denied');

  jwt.verify(token, secretKey, async (err, decoded) => {
    if (err) return res.status(401).send('Invalid token');

    const postId = req.params.id;
    const userId = decoded.userId;

    try {
      const post = await db.query('SELECT * FROM posts WHERE id = $1', [postId]);
      if (!post.rows.length) return res.status(404).send('Post not found');

      const isAuthorOrAdmin = post.rows[0].author_id === userId || decoded.role === 'admin';
      if (!isAuthorOrAdmin) return res.status(403).send('Access denied');

      await db.query('DELETE FROM posts WHERE id = $1', [postId]);
      res.send('Post deleted');
    } catch (error) {
      console.error(error);
      res.status(500).send('Server error');
    }
  });
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});