const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('./db'); // Assume you have a database connection

const app = express();
app.use(express.json());

const secretKey = 'your_secret_key';

app.delete('/posts/:id', (req, res) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).send('Access denied');

  jwt.verify(token, secretKey, async (err, decoded) => {
    if (err) return res.status(401).send('Invalid token');

    const userId = decoded.userId;
    const postId = req.params.id;

    try {
      // Check if the user owns the post or is an admin
      const result = await db.query(
        'SELECT * FROM posts WHERE id = $1 AND (author_id = $2 OR role = \'admin\')',
        [postId, userId]
      );

      if (result.rows.length === 0) {
        return res.status(403).send('Access denied');
      }

      // Delete the post
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