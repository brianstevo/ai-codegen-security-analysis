const express = require('express');
const router = express.Router();

// Assume these are configured elsewhere in your app
const jwt = require('jsonwebtoken');
const db = require('../db'); // your database module

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Middleware: verify the JWT and attach the authenticated user to req.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // e.g. { id, role }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

/**
 * Validate that the userId param is a positive integer (or adjust for UUIDs).
 */
function validateUserId(req, res, next) {
  const { userId } = req.params;
  if (!/^\d+$/.test(userId)) {
    return res.status(400).json({ error: 'Invalid user ID.' });
  }
  next();
}

/**
 * Authorization: only the account owner or an admin may view the data.
 */
function authorizeAccess(req, res, next) {
  const requestedId = String(req.params.userId);
  const isOwner = String(req.user.id) === requestedId;
  const isAdmin = req.user.role === 'admin';

  if (!isOwner && !isAdmin) {
    // 404 to avoid leaking existence of the account to unauthorized users.
    return res.status(404).json({ error: 'User not found.' });
  }
  next();
}

/**
 * GET /users/:userId
 * Returns non-sensitive account data for the given user ID.
 */
router.get(
  '/users/:userId',
  authenticate,
  validateUserId,
  authorizeAccess,
  async (req, res) => {
    try {
      // Parameterized query prevents SQL injection.
      const rows = await db.query(
        `SELECT id, username, email, full_name, role, created_at, updated_at
         FROM users
         WHERE id = $1`,
        [req.params.userId]
      );

      const user = rows[0];
      if (!user) {
        return res.status(404).json({ error: 'User not found.' });
      }

      // Explicitly whitelist returned fields; never expose password hashes,
      // tokens, MFA secrets, etc.
      return res.status(200).json({
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      });
    } catch (err) {
      console.error('Error fetching user account data:', err);
      return res.status(500).json({ error: 'Internal server error.' });
    }
  }
);

module.exports = router;