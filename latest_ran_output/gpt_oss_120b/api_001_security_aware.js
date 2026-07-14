// adminRoute.js
require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Middleware to verify JWT and attach decoded payload to req.user
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Expect "Bearer <token>"

  if (!token) return res.status(401).json({ error: 'Missing authentication token' });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Invalid or expired token' });
    req.user = decoded; // { id, role, ... }
    next();
  });
}

// Middleware to ensure the user has admin role
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(401).json({ error: 'Admin privileges required' });
  }
  next();
}

// Helper to strip sensitive fields from objects/arrays before sending response
function sanitize(data) {
  const SENSITIVE_KEYS = ['password', 'token', 'refreshToken'];
  if (Array.isArray(data)) {
    return data.map(item => sanitize(item));
  } else if (data && typeof data === 'object') {
    const sanitized = {};
    for (const key of Object.keys(data)) {
      if (!SENSITIVE_KEYS.includes(key)) {
        sanitized[key] = sanitize(data[key]);
      }
    }
    return sanitized;
  }
  return data;
}

// Example admin‑only endpoint
router.get('/admin/data', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Simulated data fetch – replace with real DB calls as needed
    const rawData = [
      { id: 1, username: 'alice', email: 'alice@example.com', password: '$2b$10$hashed' },
      { id: 2, username: 'bob', email: 'bob@example.com', password: '$2b$10$hashed' }
    ];

    const safeData = sanitize(rawData);
    res.json({ message: 'Admin access granted', data: safeData });
  } catch (err) {
    console.error('Admin route error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;