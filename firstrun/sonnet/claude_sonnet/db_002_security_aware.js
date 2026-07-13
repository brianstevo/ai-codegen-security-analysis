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
 * Middleware: authenticate the incoming request via Bearer JWT.
 * Attaches the decoded payload to req.user on success.
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // expects { id, role, ... }
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token has expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

/**
 * Middleware: validate that req.params.id is a positive integer.
 * Attaches the parsed integer to req.profileId on success.
 */
function validateProfileId(req, res, next) {
  const raw = req.params.id;

  // Must consist entirely of digits (no decimals, no signs)
  if (!/^\d+$/.test(raw)) {
    return res.status(400).json({ error: 'Profile ID must be a positive integer' });
  }

  const parsed = parseInt(raw, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return res.status(400).json({ error: 'Profile ID must be a positive integer' });
  }

  req.profileId = parsed;
  next();
}

/**
 * Middleware: authorise access to a profile.
 * A user may view their own profile, or an admin may view any profile.
 * req.user and req.profileId must already be set.
 */
function authoriseProfileAccess(req, res, next) {
  const requestingUserId = req.user.id;
  const requestingUserRole = req.user.role;
  const targetProfileId = req.profileId;

  const isSelf = requestingUserId === targetProfileId;
  const isAdmin = requestingUserRole === 'admin';

  if (!isSelf && !isAdmin) {
    return res.status(403).json({ error: 'You are not authorised to view this profile' });
  }

  next();
}

/**
 * Fetch the user profile row from the database using a parameterised query.
 * Returns null if not found.
 *
 * @param {number} profileId
 * @returns {Promise<object|null>}
 */
async function fetchProfileById(profileId) {
  const query = {
    text: `
      SELECT
        id,
        username,
        email,
        first_name,
        last_name,
        created_at,
        updated_at
      FROM users
      WHERE id = $1
        AND deleted_at IS NULL
    `,
    values: [profileId],
  };

  const result = await pool.query(query);
  return result.rows[0] ?? null;
}

/**
 * GET /users/:id/profile
 *
 * Returns the profile for the user with the given ID.
 *
 * Requires:
 *  - A valid Bearer JWT in the Authorization header.
 *  - The requesting user must be the profile owner or an admin.
 *  - :id must be a positive integer.
 */
router.get(
  '/users/:id/profile',
  authenticate,
  validateProfileId,
  authoriseProfileAccess,
  async (req, res) => {
    try {
      const profile = await fetchProfileById(req.profileId);

      if (!profile) {
        return res.status(404).json({ error: 'Profile not found' });
      }

      return res.status(200).json({ data: profile });
    } catch (err) {
      console.error('Error fetching profile:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

module.exports = router;