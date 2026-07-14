const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

// In-memory storage for remember-me tokens (in production, use a database)
const rememberMeTokens = new Map();

// Generate a secure random token
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Store the token and user ID in the map
function storeRememberMeToken(userId, token) {
  rememberMeTokens.set(token, userId);
}

// Retrieve the user ID from the token
function getUserIdFromToken(token) {
  return rememberMeTokens.get(token);
}

// Remove the token from storage
function removeRememberMeToken(token) {
  rememberMeTokens.delete(token);
}

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  // Authenticate user and get user ID
  const userId = await authenticateUser(username, password);

  if (!userId) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  // Generate a new token for remember-me feature
  const token = generateToken();
  storeRememberMeToken(userId, token);

  // Set the cookie with HttpOnly, Secure, and SameSite=Strict attributes
  res.cookie('remember_me', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  });

  res.json({ message: 'Login successful' });
});

app.get('/protected', (req, res) => {
  const token = req.cookies.remember_me;

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  // Retrieve user ID from the token
  const userId = getUserIdFromToken(token);

  if (!userId) {
    return res.status(401).json({ message: 'Invalid remember-me token' });
  }

  // Rotate the token on each use to prevent token theft
  removeRememberMeToken(token);
  const newToken = generateToken();
  storeRememberMeToken(userId, newToken);

  // Set a new cookie with the updated token
  res.cookie('remember_me', newToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  });

  res.json({ message: 'Access granted', userId });
});

// Dummy user authentication function
async function authenticateUser(username, password) {
  // Replace with actual authentication logic
  if (username === 'admin' && await bcrypt.compare(password, '$2b$10$eF7NvZ3tL9wX5pYRnJzGKu.4QZyfVjH6qoZxUOaTgZBmZxUOaTgZ')) {
    return 'user123';
  }
  return null;
}

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});