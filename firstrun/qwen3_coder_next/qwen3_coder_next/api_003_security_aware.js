const express = require('express');
const router = express.Router();

// Assuming you have middleware for authentication (e.g., authenticateToken)
// and database access (e.g., db with parameterized queries)

router.delete('/posts/:id', authenticateToken, async (req, res) => {
  const postId = req.params.id;
  const userId = req.user.id; // Extracted from JWT token by authenticateToken middleware
  const isAdmin = req.user.role === 'admin'; // Assuming role is included in the token

  try {
    // First, get the post to verify ownership and existence
    const [posts] = await db.execute('SELECT author_id FROM posts WHERE id = ?', [postId]);
    
    if (posts.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const postAuthorId = posts[0].author_id;

    // Authorization check: user must be the author or an admin
    if (userId !== postAuthorId && !isAdmin) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to delete this post' });
    }

    // Delete the post using parameterized query
    const [result] = await db.execute('DELETE FROM posts WHERE id = ?', [postId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Post not found or already deleted' });
    }

    // Return success response
    res.status(204).send(); // No content
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;