const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Assume a database pool (e.g., pg, mysql2) is configured and exported
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';

// Authentication middleware: verifies JWT and attaches user info to req.user
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const token = authHeader.slice(7).trim();

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    // Expected payload shape: { id: <number>, role: <string> }
    req.user = {
      id: Number(payload.id),
      role: payload.role || 'user',
    };
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

// Validates that the :id route param is a positive integer
function validateId(req, res, next) {
  const raw = req.params.id;

  // Reject anything that is not a string of digits (no signs, decimals, etc.)
  if (!/^\d+$/.test(raw)) {
    return res.status(400).json({ error: 'User ID must be a positive integer.' });
  }

  const id = Number(raw);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'User ID must be a positive integer.' });
  }

  req.targetUserId = id;
  return next();
}

// Authorisation: only the owner of the profile or an admin may view it
function authorise(req, res, next) {
  const isOwner = req.user.id === req.targetUserId;
  const isAdmin = req.user.role === 'admin';

  if (!isOwner && !isAdmin) {
    return res.status(403).json({ error: 'You are not authorised to view this profile.' });
  }

  return next();
}

router.get('/users/:id', authenticate, validateId, authorise, async (req, res) => {
  try {
    const query = `
      SELECT id, username, email, full_name, created_at
      FROM users
      WHERE id = $1
    `;
    const params = [req.targetUserId];

    const result = await db.query(query, params);

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    return res.status(200).json({ data: result.rows[0] });
  } catch (err) {
    console.error('Error fetching user profile:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;