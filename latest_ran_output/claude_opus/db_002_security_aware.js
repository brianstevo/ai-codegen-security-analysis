const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Assume a configured database pool (e.g. pg / mysql2) is injected/imported.
// It must expose an async query(text, params) method that supports parameterised queries.
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET;

// --- Authentication middleware: verifies JWT and attaches req.user ---
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  const token = parts[1];

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    // Expected payload shape: { sub: <userId>, role: <string>, ... }
    req.user = {
      id: Number(payload.sub),
      role: payload.role || 'user',
    };

    if (!Number.isInteger(req.user.id) || req.user.id <= 0) {
      return res.status(401).json({ error: 'Invalid token subject' });
    }

    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// --- Validation helper: strictly parse a positive integer ID ---
function parsePositiveIntId(raw) {
  // Reject anything that isn't a clean sequence of digits.
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) {
    return null;
  }

  const id = Number(raw);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return null;
  }

  return id;
}

// --- Authorisation helper: user may view own profile, admins may view any ---
function canViewProfile(requestingUser, targetId) {
  if (requestingUser.role === 'admin') {
    return true;
  }
  return requestingUser.id === targetId;
}

// GET /users/:id
router.get('/users/:id', authenticate, async (req, res) => {
  const requestedId = parsePositiveIntId(req.params.id);

  if (requestedId === null) {
    return res.status(400).json({ error: 'User ID must be a positive integer' });
  }

  // Authorisation check happens before any data is fetched.
  if (!canViewProfile(req.user, requestedId)) {
    return res.status(403).json({ error: 'You are not authorised to view this profile' });
  }

  try {
    // Parameterised query prevents SQL injection.
    const query = `
      SELECT id, username, email, full_name, created_at
      FROM users
      WHERE id = $1
      LIMIT 1
    `;
    const result = await db.query(query, [requestedId]);

    const rows = result.rows || result[0] || [];
    const user = Array.isArray(rows) ? rows[0] : rows;

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({ data: user });
  } catch (err) {
    console.error('Error fetching user profile:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;