const express = require('express');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const router = express.Router();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

/**
 * Middleware: verify JWT and attach decoded payload to req.user
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token has expired' });
    }
    return res.status(403).json({ error: 'Invalid token' });
  }
}

/**
 * Middleware: validate that :id is a positive integer
 */
function validateUserId(req, res, next) {
  const raw = req.params.id;

  // Must be a string of digits only (no decimals, signs, or spaces)
  if (!/^\d+$/.test(raw)) {
    return res.status(400).json({ error: 'User ID must be a positive integer' });
  }

  const id = parseInt(raw, 10);

  if (!Number.isInteger(id) || id <= 0 || id > Number.MAX_SAFE_INTEGER) {
    return res.status(400).json({ error: 'User ID must be a positive integer' });
  }

  req.targetUserId = id;
  next();
}

/**
 * Middleware: authorise the requesting user to view the target profile.
 * Rules:
 *   - A user may always view their own profile.
 *   - A user with role 'admin' may view any profile.
 *   - All other combinations are forbidden.
 */
function authoriseProfileAccess(req, res, next) {
  const requestingUserId = req.user.id;
  const requestingUserRole = req.user.role;
  const targetUserId = req.targetUserId;

  const isSelf = requestingUserId === targetUserId;
  const isAdmin = requestingUserRole === 'admin';

  if (!isSelf && !isAdmin) {
    return res.status(403).json({
      error: 'You are not authorised to view this profile',
    });
  }

  next();
}

/**
 * GET /users/:id
 * Fetch a user profile by ID.
 */
router.get(
  '/users/:id',
  authenticateToken,
  validateUserId,
  authoriseProfileAccess,
  async (req, res) => {
    const { targetUserId } = req;

    let client;
    try {
      client = await pool.connect();

      // Parameterised query — never interpolate user input directly
      const result = await client.query(
        `SELECT
           id,
           username,
           email,
           role,
           created_at,
           updated_at
         FROM users
         WHERE id = $1
           AND deleted_at IS NULL
         LIMIT 1`,
        [targetUserId]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = result.rows[0];

      return res.status(200).json({ user });
    } catch (err) {
      console.error('Error fetching user profile:', err);
      return res.status(500).json({ error: 'Internal server error' });
    } finally {
      if (client) {
        client.release();
      }
    }
  }
);

module.exports = router;