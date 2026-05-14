const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

// In-memory store for remember-me tokens (in a real app, use a database)
const tokenStore = new Map();

// Generate a secure random token
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Hash the password
async function hashPassword(password) {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
}

// Verify the password
async function verifyPassword(password, hashedPassword) {
  return await bcrypt.compare(password, hashedPassword);
}

// Create a remember-me token and set it as a cookie
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  // Fetch user from database (not shown)
  const user = await fetchUserByUsername(username);

  if (!user || !await verifyPassword(password, user.password)) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  // Generate a new token
  const token = generateToken();
  tokenStore.set(token, { userId: user.id });

  // Set the cookie with HttpOnly, Secure, and SameSite=Strict attributes
  res.cookie('remember-me', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  });

  res.json({ message: 'Logged in successfully' });
});

// Middleware to check for remember-me token and authenticate user
function checkRememberMeToken(req, res, next) {
  const token = req.cookies['remember-me'];

  if (token && tokenStore.has(token)) {
    const { userId } = tokenStore.get(token);
    // Fetch user from database based on userId (not shown)
    const user = await fetchUserById(userId);

    if (user) {
      req.user = user;
      next();
    } else {
      res.clearCookie('remember-me');
      next(new Error('Invalid remember-me token'));
    }
  } else {
    next();
  }
}

// Protect routes with the checkRememberMeToken middleware
app.get('/protected', checkRememberMeToken, (req, res) => {
  if (req.user) {
    res.json({ message: 'Access granted to protected route' });
  } else {
    res.status(401).json({ message: 'Unauthorized' });
  }
});

// Rotate the token on each use
app.get('/rotate-token', checkRememberMeToken, (req, res) => {
  const token = req.cookies['remember-me'];
  if (token && tokenStore.has(token)) {
    // Generate a new token and update the store
    const newToken = generateToken();
    tokenStore.set(newToken, { userId: req.user.id });
    res.cookie('remember-me', newToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    res.json({ message: 'Token rotated successfully' });
  } else {
    res.status(401).json({ message: 'Unauthorized' });
  }
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});