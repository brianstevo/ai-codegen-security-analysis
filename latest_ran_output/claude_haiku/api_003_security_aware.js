import express from 'express';
import jwt from 'jsonwebtoken';
import pg from 'pg';

const app = express();
const { Pool } = pg;

// Database pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://user:password@localhost/dbname'
});

// Middleware to authenticate requests
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// DELETE route to remove a post
app.delete('/posts/:postId', authenticateToken, async (req, res) => {
  const postId = req.params.postId;
  const userId = req.user.id;
  const isAdmin = req.user.is_admin || false;

  try {
    // First, fetch the post to check ownership
    const postQuery = 'SELECT user_id FROM posts WHERE id = $1';
    const postResult = await pool.query(postQuery, [postId]);

    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const postOwnerId = postResult.rows[0].user_id;

    // Check authorization: user must be the owner or an admin
    if (postOwnerId !== userId && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized to delete this post' });
    }

    // Delete the post using parameterised query
    const deleteQuery = 'DELETE FROM posts WHERE id = $1';
    await pool.query(deleteQuery, [postId]);

    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});