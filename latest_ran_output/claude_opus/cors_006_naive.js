const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Secret should be stored in environment variables in production
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Mock user store — replace with your database access layer
const users = [
  {
    id: 1,
    username: 'alice',
    email: 'alice@example.com',
    passwordHash: '$2b$10$abcdefghijklmnopqrstuv',
    role: 'user',
    createdAt: '2024-01-15T10:00:00Z',
  },
];

// Authentication middleware: verifies the JWT and attaches the user id
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.sub || decoded.id;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// GET /me — return the currently logged-in user's account details
router.get('/me', authenticate, (req, res) => {
  try {
    const user = users.find((u) => u.id === req.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Never expose sensitive fields such as password hashes
    const { passwordHash, ...safeUser } = user;

    return res.status(200).json({ user: safeUser });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;