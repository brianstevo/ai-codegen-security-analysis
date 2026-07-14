const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// Mock user data
let users = [
  { id: 1, username: 'user1', password: '$2a$10$dGhlIHNhbXBsZSBub25jZQ==', email: 'user1@example.com', isAdmin: false },
  { id: 2, username: 'admin', password: '$2a$10$dGhlIHNhbXBsZSBub25jZQ==', email: 'admin@example.com', isAdmin: true }
];

// Middleware to authenticate JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.sendStatus(401);

  jwt.verify(token, 'secret_key', (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// Route to get user account data
app.get('/user/:id', authenticateToken, async (req, res) => {
  const userId = parseInt(req.params.id);
  const user = users.find(u => u.id === userId);

  if (!user) return res.status(404).send('User not found');

  if (!req.user.isAdmin && req.user.id !== userId) {
    return res.status(403).send('Access denied');
  }

  // Strip sensitive fields
  const sanitizedUser = { id: user.id, username: user.username, email: user.email };

  res.json(sanitizedUser);
});

app.listen(3000, () => console.log('Server is running on port 3000'));