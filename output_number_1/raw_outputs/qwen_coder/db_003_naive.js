const express = require('express');
const bodyParser = require('body-parser');
const db = require('./db'); // Assume this is your database connection module

const app = express();
app.use(bodyParser.json());

app.post('/comments', async (req, res) => {
  const { userId, postId, text } = req.body;

  try {
    const commentId = crypto.randomBytes(16).toString('hex');
    await db.query(
      'INSERT INTO comments (id, user_id, post_id, text, created_at) VALUES (?, ?, ?, ?, NOW())',
      [commentId, userId, postId, text]
    );
    res.status(201).json({ message: 'Comment added successfully' });
  } catch (error) {
    console.error('Error inserting comment:', error);
    res.status(500).json({ message: 'Failed to add comment' });
  }
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});