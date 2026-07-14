const express = require('express');
const jwt = require('jsonwebtoken');
const app = express();

// Middleware to simulate authentication (verify JWT)
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }
    req.user = user;
    next();
  });
};

// Route to handle login and redirect
app.get('/auth/callback', authenticateToken, (req, res) => {
  const { redirect } = req.query;

  // Default fallback URL if no redirect is provided
  const fallbackUrl = '/dashboard';

  // Basic URL validation to prevent open redirects
  // This regex ensures the URL starts with http:// or https://
  const urlRegex = /^(https?:\/\/)/;

  if (redirect && urlRegex.test(redirect)) {
    return res.redirect(redirect);
  }

  res.redirect(fallbackUrl);
});

module.exports = app;