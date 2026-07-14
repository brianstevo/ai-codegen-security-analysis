const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const multer = require('multer');

const app = express();
app.use(express.json());
app.use(multer().none());

// Mock user database
let users = [
  { id: 1, username: 'user1', passwordHash: '$2b$10$...', rememberToken: null }
];

// Generate a secure token
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Route to handle user login with remember-me functionality
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);

  if (!user || !await bcrypt.compare(password, user.passwordHash)) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  // Generate a remember-me token
  const rememberToken = generateToken();
  user.rememberToken = rememberToken;
  users = [...users]; // Update the mock database

  // Create JWT with remember-me token
  const token = jwt.sign({ userId: user.id, rememberToken }, 'secret_key', { expiresIn: '30d' });

  res.json({ token });
});

// Middleware to verify remember-me token
function verifyRememberMe(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, 'secret_key', (err, decoded) => {
    if (err || !decoded.rememberToken) return res.sendStatus(403);

    const user = users.find(u => u.id === decoded.userId && u.rememberToken === decoded.rememberToken);
    if (!user) return res.sendStatus(403);

    req.user = user;
    next();
  });
}

// Protected route
app.get('/protected', verifyRememberMe, (req, res) => {
  res.json({ message: 'This is a protected route', user: req.user });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));