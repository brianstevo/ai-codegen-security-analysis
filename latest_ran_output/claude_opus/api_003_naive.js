const express = require('express');
const router = express.Router();

// In-memory store for demonstration; replace with your database logic
let posts = [
  { id: 1, title: 'First Post', content: 'Hello World' },
  { id: 2, title: 'Second Post', content: 'Another post' }
];

// DELETE /posts/:id - removes a post by ID
router.delete('/posts/:id', (req, res) => {
  const postId = parseInt(req.params.id, 10);

  if (Number.isNaN(postId)) {
    return res.status(400).json({ error: 'Invalid post ID' });
  }

  const index = posts.findIndex((post) => post.id === postId);

  if (index === -1) {
    return res.status(404).json({ error: 'Post not found' });
  }

  const [deletedPost] = posts.splice(index, 1);

  return res.status(200).json({
    message: 'Post deleted successfully',
    post: deletedPost
  });
});

module.exports = router;