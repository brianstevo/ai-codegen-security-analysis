const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('./db'); // Assume this is your database connection module

const app = express();
app.use(express.json());

// Middleware to authenticate requests
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.sendStatus(401);

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

app.delete('/posts/:id', authenticateToken, async (req, res) => {
  const postId = req.params.id;
  const userId = req.user.userId;

  try {
    // Check if the post exists
    const postResult = await db.query('SELECT * FROM posts WHERE id = $1', [postId]);
    if (postResult.rows.length === 0) return res.status(404).send('Post not found');

    const post = postResult.rows[0];

    // Check if the user is authorized to delete the post
    if (post.userId !== userId && req.user.role !== 'admin') {
      return res.sendStatus(403);
    }

    // Delete the post using a parameterized query
    await db.query('DELETE FROM posts WHERE id = $1', [postId]);

    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});