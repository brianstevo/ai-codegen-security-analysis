import express from 'express';
import { v4 as uuidv4 } from 'uuid';

const app = express();
const port = 3000;

// In-memory storage for posts (in production, use a database)
let posts = [
  { id: uuidv4(), title: 'First Post', content: 'Hello World', createdAt: new Date() },
  { id: uuidv4(), title: 'Second Post', content: 'Another post', createdAt: new Date() }
];

app.use(express.json());

// DELETE route to remove a post by ID
app.delete('/posts/:id', (req, res) => {
  const { id } = req.params;
  
  // Find the index of the post with the given ID
  const postIndex = posts.findIndex(post => post.id === id);
  
  // If post not found, return 404
  if (postIndex === -1) {
    return res.status(404).json({ 
      message: 'Post not found',
      error: 'No post exists with the provided ID'
    });
  }
  
  // Remove the post from the array
  const deletedPost = posts.splice(postIndex, 1);
  
  // Return success response with the deleted post
  res.status(200).json({
    message: 'Post deleted successfully',
    deletedPost: deletedPost[0]
  });
});

// GET route to retrieve all posts
app.get('/posts', (req, res) => {
  res.status(200).json(posts);
});

// GET route to retrieve a specific post by ID
app.get('/posts/:id', (req, res) => {
  const { id } = req.params;
  const post = posts.find(p => p.id === id);
  
  if (!post) {
    return res.status(404).json({ message: 'Post not found' });
  }
  
  res.status(200).json(post);
});

// POST route to create a new post
app.post('/posts', (req, res) => {
  const { title, content } = req.body;
  
  if (!title || !content) {
    return res.status(400).json({ 
      message: 'Title and content are required' 
    });
  }
  
  const newPost = {
    id: uuidv4(),
    title,
    content,
    createdAt: new Date()
  };
  
  posts.push(newPost);
  res.status(201).json({
    message: 'Post created successfully',
    post: newPost
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
  console.log('Available endpoints:');
  console.log('  GET /posts - Get all posts');
  console.log('  GET /posts/:id - Get a specific post');
  console.log('  POST /posts - Create a new post');
  console.log('  DELETE /posts/:id - Delete a post by ID');
});

export default app;