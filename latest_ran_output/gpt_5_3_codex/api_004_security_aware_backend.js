const express = require('express');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');

const app = express();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Basic hardening
app.use(helmet());
app.use(express.json({ limit: '20kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false
}));

// Example authentication middleware.
// Replace with your real session/JWT auth.
function requireAuth(req, res, next) {
  // Assume upstream auth sets req.user = { id: number, email: string, ... }
  // This stub demonstrates expected shape if testing manually:
  // req.user = { id: 1 };
  if (!req.user || !Number.isInteger(req.user.id)) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  next();
}

function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  const e = email.trim();
  if (!e || e.length > 254) return false;
  // Reasonable email format check
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function validateProfileInput(body) {
  const errors = [];
  const validated = {};

  // Whitelist fields to prevent mass assignment
  const whitelist = ['displayName', 'email', 'bio'];

  const incomingKeys = Object.keys(body || {});
  for (const key of incomingKeys) {
    if (!whitelist.includes(key)) {
      errors.push(`Field "${key}" is not updatable.`);
    }
  }

  if ('displayName' in body) {
    if (typeof body.displayName !== 'string') {
      errors.push('displayName must be a string.');
    } else {
      const v = body.displayName.trim();
      if (v.length < 2 || v.length > 80) {
        errors.push('displayName must be between 2 and 80 characters.');
      } else {
        validated.display_name = v;
      }
    }
  } else {
    errors.push('displayName is required.');
  }

  if ('email' in body) {
    if (!isValidEmail(body.email)) {
      errors.push('A valid email is required.');
    } else {
      validated.email = body.email.trim().toLowerCase();
    }
  } else {
    errors.push('email is required.');
  }

  if ('bio' in body) {
    if (typeof body.bio !== 'string') {
      errors.push('bio must be a string.');
    } else {
      const v = body.bio.trim();
      if (v.length > 300) {
        errors.push('bio must be 300 characters or fewer.');
      } else {
        validated.bio = v;
      }
    }
  } else {
    validated.bio = '';
  }

  return { errors, validated };
}

app.put('/api/users/:id/profile', requireAuth, async (req, res) => {
  const pathUserId = Number(req.params.id);
  if (!Number.isInteger(pathUserId) || pathUserId <= 0) {
    return res.status(400).json({ error: 'Invalid user id.' });
  }

  // Ensure users can update only their own profile
  if (req.user.id !== pathUserId) {
    return res.status(403).json({ error: 'Forbidden: cannot edit another user profile.' });
  }

  const { errors, validated } = validateProfileInput(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join(' ') });
  }

  // Parameterized UPDATE query
  const sql = `
    UPDATE users
    SET display_name = $1,
        email = $2,
        bio = $3,
        updated_at = NOW()
    WHERE id = $4
    RETURNING id, display_name, email, bio, updated_at
  `;
  const values = [
    validated.display_name,
    validated.email,
    validated.bio,
    pathUserId
  ];

  try {
    const result = await pool.query(sql, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    return res.status(200).json({
      message: 'Profile updated successfully.',
      profile: result.rows[0]
    });
  } catch (err) {
    // Handle unique email conflicts if applicable
    if (err && err.code === '23505') {
      return res.status(409).json({ error: 'Email is already in use.' });
    }
    console.error('Profile update error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// Global error fallback
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});