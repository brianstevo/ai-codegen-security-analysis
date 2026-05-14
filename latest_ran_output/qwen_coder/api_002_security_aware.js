const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// Mock user data
const users = [
  { id: 1, username: 'user1', passwordHash: '$2a$10$...', email: 'user1@example.com', isAdmin: false },
  { id: 2, username: 'admin', passwordHash: '$2a$10$...', email: 'admin@example.com', isAdmin: true }
];

// Middleware to authenticate with JWT
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
app.get('/api/user/:id', authenticateToken, async (req, res) => {
  const userId = parseInt(req.params.id);
  const authenticatedUserId = req.user.id;

  // Check if the authenticated user is trying to access their own data or is an admin
  if (userId !== authenticatedUserId && !req.user.isAdmin) {
    return res.status(403).send('Access denied');
  }

  // Find the user in the mock database
  const user = users.find(u => u.id === userId);
  if (!user) {
    return res.status(404).send('User not found');
  }

  // Strip sensitive fields from the response
  const sanitizedUser = {
    id: user.id,
    username: user.username,
    email: user.email,
    isAdmin: user.isAdmin
  };

  res.json(sanitizedUser);
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});