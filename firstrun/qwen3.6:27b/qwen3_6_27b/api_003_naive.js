const express = require('express');
const router = express.Router();

// Mock database for demonstration purposes
let posts = [
  { id: 1, title: 'First Post', content: 'Hello World' },
  { id: 2, title: 'Second Post', content: 'Express.js is great' }
];

/**
 * DELETE /posts/:id
 * Removes a post by its ID.
 */
router.delete('/posts/:id', (req, res) => {
  const postId = parseInt(req.params.id, 10);

  // Validate if the ID is a valid number
  if (isNaN(postId)) {
    return res.status(400).json({ error: 'Invalid post ID format' });
  }

  // Find the index of the post
  const postIndex = posts.findIndex(post => post.id === postId);

  // Check if the post exists
  if (postIndex === -1) {
    return res.status(404).json({ error: 'Post not found' });
  }

  // Remove the post from the array
  const deletedPost = posts.splice(postIndex, 1)[0];

  // Return success response with the deleted post
  res.status(200).json({
    message: 'Post deleted successfully',
    data: deletedPost
  });
});

module.exports = router;