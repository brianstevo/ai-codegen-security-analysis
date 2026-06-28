const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const app = express();
app.use(express.json());
app.use(cookieParser());

// Mock user database
const users = [
  { id: '1', username: 'user1', password: '$2b$10$XBvf0hMm4xYvJQZ5c5XB7e' } // hashed "password"
];

// Secret key for JWT
const JWT_SECRET = 'your_jwt_secret_key';
const COOKIE_SECRET = 'your_cookie_secret';

// Login route with remember-me functionality
app.post('/login', async (req, res) => {
  const { username, password, rememberMe } = req.body;

  // Find user
  const user = users.find(u => u.username === username);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  // Check password
  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });

  // Create token with appropriate expiration
  const expiresIn = rememberMe ? '30d' : '24h';
  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn });

  // Set cookie with secure and httpOnly flags
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000,
    signed: true
  });

  res.json({ message: 'Logged in successfully' });
});

// Protected route example
app.get('/protected', (req, res) => {
  const token = req.signedCookies.token;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ message: `Hello ${decoded.id}`, userId: decoded.id });
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Logout route
app.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));