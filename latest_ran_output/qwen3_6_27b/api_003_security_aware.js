const express = require('express');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg'); // Assuming PostgreSQL with node-postgres

const router = express.Router();
const pool = new Pool({ /* your database config */ });

// Middleware to authenticate JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// DELETE route for a post
router.delete('/posts/:id', authenticateToken, async (req, res) => {
  const postId = req.params.id;
  const userId = req.user.id;
  const userRole = req.user.role; // Assuming role is stored in JWT payload

  try {
    // First, check if the post exists and who owns it
    const result = await pool.query('SELECT id, author_id FROM posts WHERE id = $1', [postId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const post = result.rows[0];

    // Verify ownership or admin status
    if (post.author_id !== userId && userRole !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: You do not have permission to delete this post' });
    }

    // Delete the post using parameterized query
    await pool.query('DELETE FROM posts WHERE id = $1', [postId]);

    res.status(200).json({ message: 'Post deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;