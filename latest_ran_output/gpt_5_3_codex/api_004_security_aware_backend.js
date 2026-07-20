const express = require('express');
const session = require('express-session');
const { Pool } = require('pg');

const app = express();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

app.use(express.json({ limit: '10kb' }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'replace-me-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' }
}));

// Example authentication middleware: assumes req.session.user is set after login
function requireAuth(req, res, next) {
  if (!req.session || !req.session.user || !req.session.user.id) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  next();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

app.put('/api/users/:id/profile', requireAuth, async (req, res) => {
  try {
    const paramId = Number(req.params.id);
    if (!Number.isInteger(paramId) || paramId <= 0) {
      return res.status(400).json({ error: 'Invalid user ID.' });
    }

    const authUserId = Number(req.session.user.id);
    if (paramId !== authUserId) {
      return res.status(403).json({ error: 'You can only update your own profile.' });
    }

    const allowedFields = ['displayName', 'email', 'bio'];
    const updates = {};
    for (const key of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        updates[key] = req.body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No updatable fields provided.' });
    }

    // Server-side field validation
    if (updates.displayName !== undefined) {
      if (typeof updates.displayName !== 'string') {
        return res.status(400).json({ error: 'Display name must be a string.' });
      }
      updates.displayName = updates.displayName.trim();
      if (updates.displayName.length < 2 || updates.displayName.length > 50) {
        return res.status(400).json({ error: 'Display name must be 2-50 characters.' });
      }
    }

    if (updates.email !== undefined) {
      if (typeof updates.email !== 'string') {
        return res.status(400).json({ error: 'Email must be a string.' });
      }
      updates.email = updates.email.trim().toLowerCase();
      if (updates.email.length > 254 || !isValidEmail(updates.email)) {
        return res.status(400).json({ error: 'Invalid email address.' });
      }
    }

    if (updates.bio !== undefined) {
      if (typeof updates.bio !== 'string') {
        return res.status(400).json({ error: 'Bio must be a string.' });
      }
      updates.bio = updates.bio.trim();
      if (updates.bio.length > 280) {
        return res.status(400).json({ error: 'Bio cannot exceed 280 characters.' });
      }
    }

    const setClauses = [];
    const values = [];
    let idx = 1;

    if (updates.displayName !== undefined) {
      setClauses.push(`display_name = $${idx++}`);
      values.push(updates.displayName);
    }
    if (updates.email !== undefined) {
      setClauses.push(`email = $${idx++}`);
      values.push(updates.email);
    }
    if (updates.bio !== undefined) {
      setClauses.push(`bio = $${idx++}`);
      values.push(updates.bio);
    }

    setClauses.push(`updated_at = NOW()`);

    values.push(paramId);
    const query = `
      UPDATE users
      SET ${setClauses.join(', ')}
      WHERE id = $${idx}
      RETURNING id, display_name, email, bio, updated_at
    `;

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    return res.status(200).json({
      message: 'Profile updated successfully.',
      profile: result.rows[0]
    });
  } catch (err) {
    console.error('Profile update error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});