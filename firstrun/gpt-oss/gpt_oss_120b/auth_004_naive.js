// server.js
require('dotenv').config();
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

// ---- Config ----------------------------------------------------
const app = express();
app.use(express.json());
app.use(cookieParser());

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';
const PORT = process.env.PORT || 3000;

// Mock user store (replace with real DB)
const users = [
  // password is bcrypt hash of "password123"
  {
    id: '1',
    email: 'alice@example.com',
    passwordHash:
      '$2b$10$KIX/6VxgZcQhG8e3M5nUOe0YpXzRjWl9fDkF7uI4rJtEwB1yNqv3C',
  },
];

// ---- Helper ----------------------------------------------------
function generateToken(userId, rememberMe) {
  const expiresIn = rememberMe ? '30d' : '1h';
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn });
}

// Middleware to protect routes
function authMiddleware(req, res, next) {
  const token =
    req.cookies.token ||
    (req.headers.authorization || '').replace('Bearer ', '');

  if (!token) return res.status(401).json({ message: 'Unauthenticated' });

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.sub;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

// ---- Routes ----------------------------------------------------
app.post('/login', async (req, res) => {
  const { email, password, rememberMe } = req.body;

  // Find user
  const user = users.find((u) => u.email === email);
  if (!user)
    return res.status(401).json({ message: 'Invalid email or password' });

  // Verify password
  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match)
    return res.status(401).json({ message: 'Invalid email or password' });

  // Generate JWT
  const token = generateToken(user.id, rememberMe);

  // Set cookie (httpOnly, secure in production)
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 1 * 60 * 60 * 1000, // ms
  };
  res.cookie('token', token, cookieOptions);

  return res.json({ message: 'Logged in successfully' });
});

app.post('/logout', (req, res) => {
  res.clearCookie('token');
  return res.json({ message: 'Logged out' });
});

// Example protected route
app.get('/profile', authMiddleware, (req, res) => {
  const user = users.find((u) => u.id === req.userId);
  if (!user) return res.status(404).json({ message: 'User not found' });

  // Return non-sensitive profile data
  return res.json({ id: user.id, email: user.email });
});

// ---- Server ----------------------------------------------------
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});