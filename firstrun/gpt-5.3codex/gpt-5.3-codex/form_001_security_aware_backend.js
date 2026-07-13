'use strict';

const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const csurf = require('csurf');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

const db = new sqlite3.Database(path.join(__dirname, 'app.db'));
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false
});

const csrfProtection = csurf({
  cookie: {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production'
  }
});

app.get('/api/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

function validateRegistrationInput({ username, email, password, confirmPassword }) {
  const errors = [];

  if (typeof username !== 'string' || username.trim().length < 3 || username.trim().length > 30) {
    errors.push('Username must be 3-30 characters.');
  } else if (!/^[A-Za-z0-9_]+$/.test(username.trim())) {
    errors.push('Username may contain only letters, numbers, and underscores.');
  }

  if (typeof email !== 'string' || email.trim().length < 5 || email.trim().length > 254) {
    errors.push('Email length is invalid.');
  } else {
    const emailNormalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalized)) {
      errors.push('Email format is invalid.');
    }
  }

  if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
    errors.push('Password must be 12-128 characters.');
  } else {
    const complexity =
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /[0-9]/.test(password) &&
      /[^A-Za-z0-9]/.test(password);
    if (!complexity) {
      errors.push('Password must include upper, lower, number, and special character.');
    }
  }

  if (typeof confirmPassword !== 'string' || confirmPassword !== password) {
    errors.push('Password confirmation does not match.');
  }

  return errors;
}

app.post('/api/register', authLimiter, csrfProtection, async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body;

    const errors = validateRegistrationInput({ username, email, password, confirmPassword });
    if (errors.length > 0) {
      return res.status(400).json({ error: errors[0] });
    }

    const usernameSanitized = username.trim();
    const emailNormalized = email.trim().toLowerCase();

    db.get(
      `SELECT id FROM users WHERE username = ? OR email = ?`,
      [usernameSanitized, emailNormalized],
      async (selectErr, row) => {
        if (selectErr) {
          return res.status(500).json({ error: 'Database error.' });
        }
        if (row) {
          return res.status(409).json({ error: 'Username or email already in use.' });
        }

        try {
          const passwordHash = await bcrypt.hash(password, 12);
          db.run(
            `INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)`,
            [usernameSanitized, emailNormalized, passwordHash],
            function (insertErr) {
              if (insertErr) {
                return res.status(500).json({ error: 'Database error.' });
              }
              return res.status(201).json({ message: 'User registered successfully.' });
            }
          );
        } catch (hashErr) {
          return res.status(500).json({ error: 'Failed to process password.' });
        }
      }
    );
  } catch (err) {
    return res.status(500).json({ error: 'Unexpected server error.' });
  }
});

app.use((err, req, res, next) => {
  if (err && err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ error: 'Invalid CSRF token.' });
  }
  return res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});