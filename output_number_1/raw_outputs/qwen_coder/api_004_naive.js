const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Mock database
let users = [
  { id: 1, username: 'user1', email: 'user1@example.com' }
];

// Middleware to authenticate token
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

// PUT route to update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  const { username, email } = req.body;
  const userId = req.user.id;

  // Find user in mock database
  let user = users.find(u => u.id === userId);
  if (!user) return res.status(404).send('User not found');

  // Update user information
  user.username = username || user.username;
  user.email = email || user.email;

  // Return updated user
  res.json(user);
});

module.exports = router;