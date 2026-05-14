const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// Mock user database
let users = [];

// Generate a secure token for remember-me feature
function generateRememberMeToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Set remember-me cookie with expiration of 30 days
function setRememberMeCookie(res, userId) {
  const token = generateRememberMeToken();
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
  res.cookie('remember_me', { token, userId }, { httpOnly: true, secure: true, expires });
}

// Verify remember-me cookie and return user if valid
function verifyRememberMeCookie(req) {
  const { remember_me } = req.cookies;
  if (remember_me && remember_me.token) {
    const user = users.find(u => u.id === remember_me.userId);
    if (user && bcrypt.compareSync(remember_me.token, user.rememberMeToken)) {
      return user;
    }
  }
  return null;
}

// Login route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);
  if (user && bcrypt.compareSync(password, user.password)) {
    setRememberMeCookie(res, user.id);
    res.json({ message: 'Logged in successfully' });
  } else {
    res.status(401).json({ message: 'Invalid credentials' });
  }
});

// Protected route
app.get('/protected', (req, res) => {
  const user = verifyRememberMeCookie(req);
  if (user) {
    res.json({ message: 'Access granted to protected route', user });
  } else {
    res.status(401).json({ message: 'Unauthorized' });
  }
});

// Start server
app.listen(3000, () => {
  console.log('Server is running on port 3000');
});