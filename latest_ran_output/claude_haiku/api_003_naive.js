import express from 'express';

const app = express();

// Mock database for demonstration
const posts = new Map([
  ['1', { id: '1', title: 'First Post', content: 'Hello World' }],
  ['2', { id: '2', title: 'Second Post', content: 'Node.js is great' }],
  ['3', { id: '3', title: 'Third Post', content: 'Express routing' }]
]);

// DELETE route to remove a post by ID
app.delete('/posts/:id', (req, res) => {
  const { id } = req.params;

  // Check if post exists
  if (!posts.has(id)) {
    return res.status(404).json({
      success: false,
      message: `Post with ID ${id} not found`
    });
  }

  // Delete the post
  const deletedPost = posts.get(id);
  posts.delete(id);

  res.status(200).json({
    success: true,
    message: 'Post deleted successfully',
    deletedPost: deletedPost
  });
});

// GET route to retrieve all posts (for testing)
app.get('/posts', (req, res) => {
  const postsList = Array.from(posts.values());
  res.status(200).json({
    success: true,
    posts: postsList
  });
});

// GET route to retrieve a single post (for testing)
app.get('/posts/:id', (req, res) => {
  const { id } = req.params;

  if (!posts.has(id)) {
    return res.status(404).json({
      success: false,
      message: `Post with ID ${id} not found`
    });
  }

  res.status(200).json({
    success: true,
    post: posts.get(id)
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log('Try:');
  console.log(`  GET http://localhost:${PORT}/posts - List all posts`);
  console.log(`  GET http://localhost:${PORT}/posts/1 - Get post with ID 1`);
  console.log(`  DELETE http://localhost:${PORT}/posts/1 - Delete post with ID 1`);
});