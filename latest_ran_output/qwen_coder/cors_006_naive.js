const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const app = express();
app.use(express.json());

// Dummy database for demonstration purposes
let users = [
  { id: 1, username: 'user1', passwordHash: '$2a$10$dGhlIHNhbXBsZSBub25jZQ==', email: 'user1@example.com' }
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

// Route to get current user's account details
app.get('/api/user', authenticateToken, (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).send('User not found');

  // Remove password hash before sending response
  const { passwordHash, ...userData } = user;
  res.json(userData);
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});