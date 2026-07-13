const express = require('express');
const router = express.Router();

// Mock data layer - replace with your actual database/ORM calls
// e.g., const User = require('../models/User');

/**
 * Middleware to verify JWT and attach the authenticated user to req.user
 */
const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, role, ... }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Simulated user lookup. Replace with a real DB query.
 * Returns null if not found.
 */
async function findUserById(userId) {
  // Example with an ORM:
  // return User.findByPk(userId);
  const fakeDb = {
    '1': {
      id: '1',
      username: 'jdoe',
      email: 'jdoe@example.com',
      role: 'user',
      passwordHash: '$2b$10$abcdefghijklmnopqrstuv', // sensitive
      mfaSecret: 'JBSWY3DPEHPK3PXP',                  // sensitive
      createdAt: '2024-01-15T10:30:00Z',
      updatedAt: '2024-06-01T08:00:00Z',
    },
  };
  return fakeDb[userId] || null;
}

/**
 * Strip sensitive fields before returning user data to the client.
 */
function sanitizeUser(user) {
  const {
    passwordHash,
    password,
    mfaSecret,
    resetToken,
    ...safe
  } = user;
  return safe;
}

/**
 * GET /users/:id
 * Returns account data for a given user ID.
 * Authorization: a user may only read their own account unless they are an admin.
 */
router.get('/users/:id', authenticate, async (req, res) => {
  const { id } = req.params;

  // Validate the ID format (adjust regex to your ID scheme)
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return res.status(400).json({ error: 'Invalid user ID format' });
  }

  // Authorization: only the owner or an admin can access this resource
  const isOwner = String(req.user.id) === String(id);
  const isAdmin = req.user.role === 'admin';

  if (!isOwner && !isAdmin) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const user = await findUserById(id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({ data: sanitizeUser(user) });
  } catch (err) {
    console.error('Error fetching user:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;