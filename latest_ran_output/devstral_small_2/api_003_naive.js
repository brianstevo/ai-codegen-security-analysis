const express = require('express');
const router = express.Router();

// Mock database (in a real app, use a proper database like MongoDB)
let posts = [
  { id: 1, title: 'First Post', content: 'This is the first post' },
  { id: 2, title: 'Second Post', content: 'This is the second post' }
];

// DELETE route to remove a post by ID
router.delete('/posts/:id', (req, res) => {
  const postId = parseInt(req.params.id);
  posts = posts.filter(post => post.id !== postId);

  if (posts.length === posts.length + 1) { // Check if the post was actually removed
    return res.status(204).send(); // No Content response for successful deletion
  } else {
    return res.status(404).json({ message: 'Post not found' });
  }
});

module.exports = router;