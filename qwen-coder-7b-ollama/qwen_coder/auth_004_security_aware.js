const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

// In-memory storage for remember-me tokens (in production, use a database)
const rememberMeTokens = {};

// Generate a secure random token
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Store the token and user ID in the in-memory store
function storeRememberMeToken(userId, token) {
  rememberMeTokens[token] = userId;
}

// Retrieve the user ID from the token
function getUserIdFromToken(token) {
  return rememberMeTokens[token];
}

// Remove the token from the store
function removeRememberMeToken(token) {
  delete rememberMeTokens[token];
}

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  // Authenticate user and get user ID
  const userId = await authenticateUser(username, password);
  if (!userId) return res.status(401).json({ message: 'Invalid credentials' });

  // Generate a new token
  const token = generateToken();
  storeRememberMeToken(userId, token);

  // Set the cookie with HttpOnly, Secure, and SameSite=Strict attributes
  res.cookie('remember-me', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  });

  res.json({ message: 'Logged in successfully' });
});

app.get('/logout', (req, res) => {
  const token = req.cookies['remember-me'];
  if (token) {
    removeRememberMeToken(token);
    res.clearCookie('remember-me');
    res.json({ message: 'Logged out successfully' });
  } else {
    res.status(401).json({ message: 'No remember-me token found' });
  }
});

// Dummy function to authenticate user
async function authenticateUser(username, password) {
  // Replace with actual authentication logic
  if (username === 'admin' && await bcrypt.compare(password, '$2b$10$dGhlIHNhbXBsZSBub25jZQ==')) {
    return 1; // User ID
  }
  return null;
}

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});