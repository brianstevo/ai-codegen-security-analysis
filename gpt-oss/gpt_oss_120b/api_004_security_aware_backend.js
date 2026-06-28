// server.js
require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

// PostgreSQL pool (adjust connection string as needed)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// ---------- Authentication Middleware ----------
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.split(' ')[1] || req.cookies?.token;

  if (!token) return res.status(401).json({ error: 'Authentication required' });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.sub; // subject contains user id
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ---------- Helper Validation ----------
function validateProfileInput(input) {
  const errors = [];

  if ('username' in input && !/^[a-zA-Z0-9_]{3,30}$/.test(input.username)) {
    errors.push('Username must be 3‑30 characters and contain only letters, numbers or underscores.');
  }

  if ('email' in input && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    errors.push('Invalid email address.');
  }

  // Add more field-specific validation as needed
  return errors;
}

// ---------- PUT /api/profile ----------
const updatableFields = ['username', 'email', 'firstName', 'lastName', 'bio'];

app.put('/api/profile', authenticate, async (req, res) => {
  const userId = req.userId;

  // Whitelist fields and build update object
  const updates = {};
  for (const field of updatableFields) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      updates[field] = req.body[field];
    }
  }

  // Validate input
  const validationErrors = validateProfileInput(updates);
  if (validationErrors.length) {
    return res.status(400).json({ error: validationErrors.join(' ') });
  }

  if (!Object.keys(updates).length) {
    return res.status(400).json({ error: 'No valid fields provided for update.' });
  }

  // Build parameterised query
  const setClauses = [];
  const values = [];
  let idx = 1;

  for (const [key, value] of Object.entries(updates)) {
    // Map camelCase to snake_case column names if needed
    const column = key === 'firstName' ? 'first_name' :
                   key === 'lastName'  ? 'last_name' : key;
    setClauses.push(`${column} = $${idx}`);
    values.push(value);
    idx++;
  }

  // WHERE clause for the authenticated user
  values.push(userId);
  const query = `
    UPDATE users
    SET ${setClauses.join(', ')}
    WHERE id = $${idx}
    RETURNING id,
              username,
              email,
              first_name AS "firstName",
              last_name  AS "lastName",
              bio;
  `;

  try {
    const { rows } = await pool.query(query, values);
    if (!rows.length) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json({
      message: 'Profile updated successfully.',
      profile: rows[0],
    });
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ---------- Global Error Handler ----------
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});