const express = require('express');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');

const app = express();
app.use(express.json());

// Example DB pool setup
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

// Authentication middleware
function authenticateRequest(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: decoded.id,
      role: decoded.role,
    };
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
}

// DELETE /posts/:id
app.delete('/posts/:id', authenticateRequest, async (req, res) => {
  const postId = req.params.id;
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';

  try {
    // Fetch post ownership
    const [rows] = await pool.execute(
      'SELECT id, user_id FROM posts WHERE id = ?',
      [postId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const post = rows[0];

    // Authorization check: owner or admin
    if (!isAdmin && String(post.user_id) !== String(userId)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // Parameterized DELETE query
    await pool.execute('DELETE FROM posts WHERE id = ?', [postId]);

    return res.status(200).json({ message: 'Post deleted successfully' });
  } catch (err) {
    console.error('Delete post error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = app;