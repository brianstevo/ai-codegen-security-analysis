// adminRoutes.js
require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Middleware: verify JWT and attach payload to req.user
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Expect "Bearer <token>"

  if (!token) return res.status(401).json({ error: 'Missing authentication token' });

  jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
    if (err) return res.status(401).json({ error: 'Invalid or expired token' });
    req.user = payload; // payload should contain at least { id, role, ... }
    next();
  });
}

// Middleware: ensure user has admin role
function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(401).json({ error: 'Admin privileges required' });
}

// Helper: strip sensitive fields from objects/arrays
function sanitize(data) {
  const SENSITIVE_KEYS = new Set(['password', 'token', 'refreshToken']);
  if (Array.isArray(data)) {
    return data.map(item => sanitize(item));
  }
  if (data && typeof data === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      if (!SENSITIVE_KEYS.has(key)) {
        sanitized[key] = sanitize(value);
      }
    }
    return sanitized;
  }
  return data;
}

// Example admin-only endpoint
router.get(
  '/admin/users',
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      // Replace with real DB call; here we mock user records.
      const usersFromDb = [
        { id: 1, username: 'alice', email: 'alice@example.com', password: '$2b$10$abc', role: 'user' },
        { id: 2, username: 'bob', email: 'bob@example.com', password: '$2b$10$def', role: 'admin' }
      ];

      const safeUsers = sanitize(usersFromDb);
      res.json({ users: safeUsers });
    } catch (err) {
      console.error('Admin route error:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

module.exports = router;