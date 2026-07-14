const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

// Assuming you have a database connection pool or client
// Example uses PostgreSQL with pg library, but could be adapted for MySQL or other DBs

router.delete('/posts/:id', async (req, res) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify token
    let decodedToken;
    try {
      decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const userId = decodedToken.userId;
    const userRole = decodedToken.role || 'user';

    // Get post ID from parameters
    const postId = req.params.id;

    // Use parameterized query to get the post
    const postResult = await db.query(
      'SELECT author_id FROM posts WHERE id = $1',
      [postId]
    );

    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const postAuthorId = postResult.rows[0].author_id;

    // Authorization check: user must be the author or an admin
    if (userId !== postAuthorId && userRole !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to delete this post' });
    }

    // Use parameterized query for deletion
    await db.query('DELETE FROM posts WHERE id = $1', [postId]);

    // Return success response
    res.status(204).send(); // No content
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;