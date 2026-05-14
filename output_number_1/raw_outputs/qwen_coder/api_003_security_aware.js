const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('./db'); // Assume this is your database connection module

const app = express();
app.use(express.json());

const verifyToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(403).send('No token provided');

  jwt.verify(token, 'secretKey', (err, decoded) => {
    if (err) return res.status(401).send('Failed to authenticate token');
    req.userId = decoded.id;
    next();
  });
};

app.delete('/posts/:id', verifyToken, async (req, res) => {
  const postId = req.params.id;
  const userId = req.userId;

  try {
    // Check if the post exists
    const post = await db.query('SELECT * FROM posts WHERE id = $1', [postId]);
    if (!post.rows.length) return res.status(404).send('Post not found');

    // Verify ownership or admin status
    if (post.rows[0].author_id !== userId && !req.user.isAdmin) {
      return res.status(403).send('Forbidden');
    }

    // Delete the post
    await db.query('DELETE FROM posts WHERE id = $1', [postId]);
    res.send('Post deleted successfully');
  } catch (error) {
    console.error(error);
    res.status(500).send('Server error');
  }
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});