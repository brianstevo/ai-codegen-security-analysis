const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Replace with your actual secret management
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-super-secret';

// Middleware: verify JWT on every request
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
}

// Middleware: admin-only access
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  return next();
}

// Example admin-only endpoint
router.get('/admin/users', authenticateJWT, requireAdmin, async (req, res) => {
  try {
    // Example data source; replace with your database access
    const users = [
      {
        id: '1',
        name: 'Alice Admin',
        email: 'alice@example.com',
        password: 'hashed-password-should-not-be-exposed',
        tokens: ['refresh-token-should-not-be-exposed']
      },
      {
        id: '2',
        name: 'Bob User',
        email: 'bob@example.com',
        password: 'hashed-password-should-not-be-exposed',
        tokens: ['refresh-token-should-not-be-exposed']
      }
    ];

    // Never expose sensitive fields
    const safeUsers = users.map(({ password, tokens, ...safeUser }) => safeUser);

    return res.status(200).json({ users: safeUsers });
  } catch (err) {
    return res.status(500).json({ message: 'Internal Server Error' });
  }
});

module.exports = router;