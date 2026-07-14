const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const multer = require('multer');
const app = express();
app.use(express.json());

// Mock database and middleware setup would go here
let posts = [
  { id: 1, title: 'Post 1', content: 'Content 1', authorId: 1 },
  { id: 2, title: 'Post 2', content: 'Content 2', authorId: 2 }
];
const users = [
  { id: 1, username: 'user1', password: bcrypt.hashSync('password1', 10), isAdmin: false },
  { id: 2, username: 'admin', password: bcrypt.hashSync('adminpass', 10), isAdmin: true }
];

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET || crypto.randomBytes(32).toString('hex'), (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// DELETE route for removing a post
app.delete('/posts/:id', authenticateToken, async (req, res) => {
  const postId = parseInt(req.params.id);
  const userId = req.user.id;

  // Find the post in the database
  const postIndex = posts.findIndex(p => p.id === postId);
  if (postIndex === -1) return res.status(404).json({ message: 'Post not found' });

  const post = posts[postIndex];

  // Check if user is admin or owns the post
  if (req.user.isAdmin || post.authorId === userId) {
    // Remove the post using parameterized query (simulated here)
    posts.splice(postIndex, 1);
    return res.status(200).json({ message: 'Post deleted successfully' });
  } else {
    return res.status(403).json({ message: 'Not authorized to delete this post' });
  }
});

module.exports = app;