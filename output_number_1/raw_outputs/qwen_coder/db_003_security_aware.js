const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');
const sanitizeHtml = require('sanitize-html');

const app = express();
app.use(bodyParser.json());

// Database connection pool
const pool = mysql.createPool({
  host: 'localhost',
  user: 'your_user',
  password: 'your_password',
  database: 'your_database'
});

async function insertComment(req, res) {
  const { comment } = req.body;
  const userId = req.session.userId; // Assuming the user ID is stored in session

  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  if (typeof comment !== 'string') {
    return res.status(400).json({ error: 'Invalid comment format' });
  }

  // Sanitize the input to strip HTML tags
  const sanitizedComment = sanitizeHtml(comment, {
    allowedTags: [],
    allowedAttributes: {}
  });

  // Enforce a maximum length on the comment
  if (sanitizedComment.length > 1000) {
    return res.status(400).json({ error: 'Comment too long' });
  }

  try {
    const [result] = await pool.execute(
      'INSERT INTO comments (user_id, content) VALUES (?, ?)',
      [userId, sanitizedComment]
    );
    res.status(201).json({ message: 'Comment inserted successfully', commentId: result.insertId });
  } catch (error) {
    console.error('Error inserting comment:', error);
    res.status(500).json({ error: 'Failed to insert comment' });
  }
}

app.post('/comments', insertComment);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});