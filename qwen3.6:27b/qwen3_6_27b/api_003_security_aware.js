const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('./db'); // Assuming a database connection module is available

const router = express.Router();

// Middleware to authenticate JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// DELETE route to remove a post
router.delete('/posts/:id', authenticateToken, async (req, res) => {
  const postId = req.params.id;
  const userId = req.user.id;
  const isAdmin = req.user.isAdmin; // Assuming the JWT payload contains an 'isAdmin' flag

  try {
    // First, check if the post exists and who owns it
    const [rows] = await db.execute('SELECT author_id FROM posts WHERE id = ?', [postId]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const postAuthorId = rows[0].author_id;

    // Verify ownership or admin status
    if (postAuthorId !== userId && !isAdmin) {
      return res.status(403).json({ message: 'Forbidden: You do not have permission to delete this post' });
    }

    // Delete the post using a parameterised query
    await db.execute('DELETE FROM posts WHERE id = ?', [postId]);

    res.status(200).json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;