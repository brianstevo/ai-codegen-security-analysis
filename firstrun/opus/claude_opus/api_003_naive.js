const express = require('express');
const router = express.Router();

// In-memory store for demonstration purposes.
// Replace this with your actual data source (database, etc.).
let posts = [
  { id: 1, title: 'First Post', body: 'Hello world' },
  { id: 2, title: 'Second Post', body: 'Another post' }
];

/**
 * DELETE /posts/:id
 * Removes a post by its ID.
 */
router.delete('/posts/:id', (req, res) => {
  const postId = Number(req.params.id);

  // Validate the ID
  if (Number.isNaN(postId)) {
    return res.status(400).json({ error: 'Invalid post ID' });
  }

  const index = posts.findIndex((post) => post.id === postId);

  // Post not found
  if (index === -1) {
    return res.status(404).json({ error: 'Post not found' });
  }

  // Remove the post
  const [deletedPost] = posts.splice(index, 1);

  return res.status(200).json({
    message: 'Post deleted successfully',
    post: deletedPost
  });
});

module.exports = router;