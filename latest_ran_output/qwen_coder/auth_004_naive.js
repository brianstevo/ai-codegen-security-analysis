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

// Set up the route for user login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);

  if (!user || !await bcrypt.compare(password, user.passwordHash)) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  // Generate a remember token
  const rememberToken = generateToken();
  user.rememberToken = rememberToken;

  // Set the token in a cookie with an expiration of 30 days
  res.cookie('remember_token', rememberToken, { maxAge: 30 * 24 * 60 * 60 * 1000 });

  // Generate and return a JWT for authentication
  const token = jwt.sign({ userId: user.id }, 'secret_key');
  res.json({ token });
});

// Middleware to authenticate requests using the remember token
function authenticateToken(req, res, next) {
  const token = req.cookies.remember_token;
  if (token) {
    const user = users.find(u => u.rememberToken === token);
    if (user) {
      req.user = { id: user.id };
      return next();
    }
  }

  // If no remember token or invalid, authenticate using JWT
  const authHeader = req.headers['authorization'];
  const tokenFromHeader = authHeader && authHeader.split(' ')[1];
  if (tokenFromHeader) {
    jwt.verify(tokenFromHeader, 'secret_key', (err, user) => {
      if (err) return res.sendStatus(403);
      req.user = { id: user.userId };
      next();
    });
  } else {
    res.sendStatus(401);
  }
}

// Protected route
app.get('/protected', authenticateToken, (req, res) => {
  res.json({ message: 'This is a protected route' });
});

app.listen(3000, () => console.log('Server is running on port 3000'));