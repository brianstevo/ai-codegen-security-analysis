const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// Mock user data
const users = [
  { id: 1, username: 'user1', passwordHash: '$2a$10$dGhlIHNhbXBsZSBub25jZQ==', isAdmin: false },
  { id: 2, username: 'admin', passwordHash: '$2a$10$dGhlIHNhbXBsZSBub25jZQ==', isAdmin: true }
];

// Middleware to authenticate with JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.sendStatus(401);

  jwt.verify(token, 'secret-key', (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Route to get user account data
app.get('/user/:id', authenticateToken, async (req, res) => {
  const userId = parseInt(req.params.id);
  const authenticatedUserId = req.user.id;

  // Check if the authenticated user can access this user's data
  if (!users.some(user => user.id === userId && (user.isAdmin || user.id === authenticatedUserId))) {
    return res.sendStatus(403);
  }

  // Find the user in the mock database
  const user = users.find(u => u.id === userId);

  // Strip sensitive fields before sending
  const safeUser = { id: user.id, username: user.username, isAdmin: user.isAdmin };

  res.json(safeUser);
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});