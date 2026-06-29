const express = require('express');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
});

const UPDATABLE_FIELDS = ['displayName', 'email', 'phone', 'location', 'bio'];

function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub || payload.id };
    if (!req.user.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

function isValidPhone(phone) {
  return typeof phone === 'string' && /^[0-9+\-().\s]{7,20}$/.test(phone);
}

function isValidText(value, maxLen) {
  return typeof value === 'string' && value.length <= maxLen;
}

function sanitizeOptionalString(value) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

app.put('/api/profile/me', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const body = req.body && typeof req.body === 'object' ? req.body : {};

    const updates = {};
    for (const field of UPDATABLE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        updates[field] = sanitizeOptionalString(body[field]);
      }
    }

    const receivedKeys = Object.keys(body);
    const invalidKeys = receivedKeys.filter((k) => !UPDATABLE_FIELDS.includes(k));
    if (invalidKeys.length > 0) {
      return res.status(400).json({ error: 'Request contains non-updatable fields.' });
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided.' });
    }

    if (updates.displayName !== undefined && updates.displayName !== null && !isValidText(updates.displayName, 80)) {
      return res.status(400).json({ error: 'Invalid displayName.' });
    }
    if (updates.email !== undefined && updates.email !== null && !isValidEmail(updates.email)) {
      return res.status(400).json({ error: 'Invalid email.' });
    }
    if (updates.phone !== undefined && updates.phone !== null && !isValidPhone(updates.phone)) {
      return res.status(400).json({ error: 'Invalid phone.' });
    }
    if (updates.location !== undefined && updates.location !== null && !isValidText(updates.location, 120)) {
      return res.status(400).json({ error: 'Invalid location.' });
    }
    if (updates.bio !== undefined && updates.bio !== null && !isValidText(updates.bio, 500)) {
      return res.status(400).json({ error: 'Invalid bio.' });
    }

    const setClauses = [];
    const values = [];

    for (const field of UPDATABLE_FIELDS) {
      if (updates[field] !== undefined) {
        setClauses.push(`${field} = ?`);
        values.push(updates[field]);
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No valid fields provided.' });
    }

    values.push(userId);

    const sql = `UPDATE users SET ${setClauses.join(', ')}, updated_at = NOW() WHERE id = ?`;
    const [result] = await pool.execute(sql, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Profile not found.' });
    }

    return res.json({ message: 'Profile updated successfully.' });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Email already in use.' });
    }
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

module.exports = app;

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}