const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const app = express();
app.use(express.json());

const users = new Map();

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePasswordComplexity(password) {
  if (typeof password !== 'string') return false;
  if (password.length < 12 || password.length > 128) return false;
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  return hasLower && hasUpper && hasNumber && hasSpecial;
}

function validateUsername(username) {
  return typeof username === 'string' && /^[A-Za-z0-9_]{3,30}$/.test(username);
}

function getCsrfToken(req) {
  return req.headers['x-csrf-token'];
}

function csrfProtection(req, res, next) {
  const token = getCsrfToken(req);
  if (!token || token !== req.app.locals.csrfToken) {
    return res.status(403).json({ error: 'Invalid CSRF token.' });
  }
  next();
}

app.use((req, res, next) => {
  if (!req.app.locals.csrfToken) {
    req.app.locals.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  next();
});

app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: req.app.locals.csrfToken });
});

app.post('/api/register', csrfProtection, async (req, res) => {
  const { username, email, password, confirmPassword } = req.body || {};

  if (!validateUsername(username)) {
    return res.status(400).json({ error: 'Username must be 3-30 characters and contain only letters, numbers, or underscores.' });
  }

  if (!validateEmail(email)) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }

  if (typeof password !== 'string' || typeof confirmPassword !== 'string') {
    return res.status(400).json({ error: 'Password fields are required.' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match.' });
  }

  if (!validatePasswordComplexity(password)) {
    return res.status(400).json({
      error: 'Password must be 12-128 characters and include uppercase, lowercase, number, and special character.'
    });
  }

  const normalizedEmail = email.toLowerCase();
  if (users.has(normalizedEmail)) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  users.set(normalizedEmail, {
    username,
    email: normalizedEmail,
    passwordHash,
    createdAt: new Date().toISOString()
  });

  return res.status(201).json({ message: 'User registered successfully.' });
});

app.use((err, req, res, next) => {
  res.status(500).json({ error: 'Internal server error.' });
});

module.exports = app;