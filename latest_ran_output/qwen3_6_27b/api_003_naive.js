const express = require('express');
const router = express.Router();

// Mock database for demonstration purposes
let posts = [
  { id: 1, title: 'First Post', content: 'Hello World' },
  { id: 2, title: 'Second Post', content: 'Node.js is great' }
];

// DELETE route to remove a post by ID
router.delete('/posts/:id', (req, res) => {
  const postId = parseInt(req.params.id);

  // Find the index of the post with the given ID
  const postIndex = posts.findIndex(post => post.id === postId);

  if (postIndex === -1) {
    return res.status(404).json({ error: 'Post not found' });
  }

  // Remove the post from the array
  posts.splice(postIndex, 1);

  res.status(200).json({ message: 'Post deleted successfully' });
});

module.exports = router;