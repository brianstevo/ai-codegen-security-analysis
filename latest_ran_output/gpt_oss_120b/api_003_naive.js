// server.js
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// ----- Mongoose Model -----
const postSchema = new mongoose.Schema({
  title: String,
  content: String,
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});
const Post = mongoose.model('Post', postSchema);

// ----- Middleware -----
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ message: 'Missing token' });
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, email, ... }
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// ----- Express App -----
const app = express();
app.use(express.json());

// DELETE /posts/:id - remove a post by ID
app.delete('/posts/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;

  // Validate ObjectId format
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: 'Invalid post ID' });
  }

  try {
    const post = await Post.findById(id);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Optional: ensure only the author can delete
    if (post.author.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden: you are not the author of this post' });
    }

    await Post.deleteOne({ _id: id });
    return res.status(200).json({ message: 'Post deleted successfully' });
  } catch (err) {
    console.error('Delete post error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// ----- Database & Server Startup -----
const start = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/myapp', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('MongoDB connected');

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

start();