const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('./db'); // Assume this is your database connection

const app = express();
app.use(express.json());

const SECRET_KEY = 'your_secret_key';

app.delete('/posts/:id', (req, res) => {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ message: 'No token provided' });

  jwt.verify(token, SECRET_KEY, async (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Failed to authenticate token' });

    const userId = decoded.userId;
    const postId = req.params.id;

    try {
      // Check if the user is an admin or owns the post
      const [rows] = await db.query('SELECT * FROM posts WHERE id = ? AND (user_id = ? OR role = "admin")', [postId, userId]);
      if (rows.length === 0) return res.status(403).json({ message: 'Access denied' });

      // Delete the post
      await db.query('DELETE FROM posts WHERE id = ?', [postId]);

      res.json({ message: 'Post deleted successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});