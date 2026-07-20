const express = require('express');
const router = express.Router();
const db = require('./db'); // expects a pool/connection with db.query(sql, params)

// Simple auth middleware placeholder: sets req.user = { id: ... }
function requireAuth(req, res, next) {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

function isValidEmail(email) {
  return typeof email === 'string' &&
    email.length <= 255 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sanitizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function validateProfileInput(body) {
  const errors = [];

  const firstName = sanitizeString(body.firstName);
  const lastName = sanitizeString(body.lastName);
  const displayName = sanitizeString(body.displayName);
  const email = sanitizeString(body.email);
  const bio = typeof body.bio === 'string' ? body.bio.trim() : '';

  if (!firstName || firstName.length < 1 || firstName.length > 50) {
    errors.push('First name is required and must be 1-50 characters.');
  }

  if (!lastName || lastName.length < 1 || lastName.length > 50) {
    errors.push('Last name is required and must be 1-50 characters.');
  }

  if (!displayName || displayName.length < 1 || displayName.length > 80) {
    errors.push('Display name is required and must be 1-80 characters.');
  }

  if (!isValidEmail(email)) {
    errors.push('A valid email address is required.');
  }

  if (bio.length > 500) {
    errors.push('Bio must be 500 characters or fewer.');
  }

  return {
    errors,
    value: { firstName, lastName, displayName, email, bio }
  };
}

// GET current user's profile (used by the frontend form)
router.get('/api/profile/:id', requireAuth, async (req, res) => {
  const profileId = Number(req.params.id);
  if (!Number.isInteger(profileId)) {
    return res.status(400).json({ error: 'Invalid profile id' });
  }

  if (req.user.id !== profileId) {
    return res.status(403).json({ error: 'You can only view your own profile' });
  }

  try {
    const [rows] = await db.query(
      'SELECT id, first_name AS firstName, last_name AS lastName, display_name AS displayName, email, bio FROM users WHERE id = ?',
      [profileId]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    return res.json({ profile: rows[0] });
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
});

// PUT update current user's profile
router.put('/api/profile/:id', requireAuth, express.json({ limit: '10kb' }), async (req, res) => {
  const profileId = Number(req.params.id);
  if (!Number.isInteger(profileId)) {
    return res.status(400).json({ error: 'Invalid profile id' });
  }

  // Ensure authenticated user can only update their own profile
  if (req.user.id !== profileId) {
    return res.status(403).json({ error: 'You can only update your own profile' });
  }

  // Whitelist of updatable fields to prevent mass assignment
  const allowedFields = ['firstName', 'lastName', 'displayName', 'email', 'bio'];
  const incomingKeys = Object.keys(req.body || {});
  const disallowedKeys = incomingKeys.filter((k) => !allowedFields.includes(k));

  if (disallowedKeys.length > 0) {
    return res.status(400).json({ error: `Unsupported field(s): ${disallowedKeys.join(', ')}` });
  }

  const { errors, value } = validateProfileInput(req.body || {});
  if (errors.length > 0) {
    return res.status(400).json({ error: errors[0], details: errors });
  }

  try {
    // Parameterised query for UPDATE
    const sql = `
      UPDATE users
      SET first_name = ?, last_name = ?, display_name = ?, email = ?, bio = ?, updated_at = NOW()
      WHERE id = ?
    `;
    const params = [
      value.firstName,
      value.lastName,
      value.displayName,
      value.email,
      value.bio || null,
      profileId
    ];

    const [result] = await db.query(sql, params);

    if (!result || result.affectedRows === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    return res.json({ message: 'Profile updated successfully' });
  } catch (err) {
    // Handle duplicate email or other DB constraint errors gracefully
    if (err && (err.code === 'ER_DUP_ENTRY' || err.errno === 1062)) {
      return res.status(409).json({ error: 'Email is already in use' });
    }
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;