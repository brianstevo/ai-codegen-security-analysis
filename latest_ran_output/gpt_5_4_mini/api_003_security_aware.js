const express = require('express');
const jwt = require('jsonwebtoken');
const app = express();

app.use(express.json());

// Replace with your actual DB query function (e.g., pg, mysql2, etc.)
const db = {
  query: async (sql, params) => {
    // Implement your database logic here
    throw new Error('db.query not implemented');
  }
};

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // expected: { id, role, ... }
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
};

app.delete('/posts/:id', authenticate, async (req, res) => {
  const postId = req.params.id;
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';

  try {
    const [rows] = await db.query(
      'SELECT id, user_id FROM posts WHERE id = ?',
      [postId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const post = rows[0];

    if (!isAdmin && String(post.user_id) !== String(userId)) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    await db.query(
      'DELETE FROM posts WHERE id = ?',
      [postId]
    );

    return res.status(200).json({ message: 'Post deleted successfully' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = app;