const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// In-memory demo storage; replace with a real database in production.
const users = [];

// Very small CSRF demo store; replace with secure session-based CSRF protection in production.
const csrfTokens = new Set();

function generateCsrfToken() {
  const token = crypto.randomBytes(32).toString('hex');
  csrfTokens.add(token);
  return token;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePasswordComplexity(password) {
  const errors = [];
  if (password.length < 12) errors.push('Password must be at least 12 characters.');
  if (!/[a-z]/.test(password)) errors.push('Password must contain a lowercase letter.');
  if (!/[A-Z]/.test(password)) errors.push('Password must contain an uppercase letter.');
  if (!/[0-9]/.test(password)) errors.push('Password must contain a number.');
  if (!/[^A-Za-z0-9]/.test(password)) errors.push('Password must contain a special character.');
  return errors;
}

app.get('/register', (req, res) => {
  const token = generateCsrfToken();
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!doctype html><html><body><input type="hidden" id="csrfToken" value="${token}"></body></html>`);
});

app.post('/register', async (req, res) => {
  const { username, email, password, confirmPassword, csrfToken } = req.body || {};
  const headerToken = req.get('x-csrf-token');

  const fieldErrors = {};

  if (!csrfToken || !headerToken || csrfToken !== headerToken || !csrfTokens.has(csrfToken)) {
    return res.status(403).json({ error: 'Invalid CSRF token.' });
  }
  csrfTokens.delete(csrfToken);

  if (typeof username !== 'string' || username.trim().length < 3 || username.trim().length > 30) {
    fieldErrors.username = 'Username must be between 3 and 30 characters.';
  } else if (!/^[a-zA-Z0-9._-]+$/.test(username.trim())) {
    fieldErrors.username = 'Username contains invalid characters.';
  }

  if (typeof email !== 'string' || email.trim().length > 254 || !isValidEmail(email.trim())) {
    fieldErrors.email = 'Please provide a valid email address.';
  }

  if (typeof password !== 'string') {
    fieldErrors.password = 'Password is required.';
  } else {
    const complexityErrors = validatePasswordComplexity(password);
    if (complexityErrors.length) {
      fieldErrors.password = complexityErrors[0];
    }
  }

  if (typeof confirmPassword !== 'string' || confirmPassword !== password) {
    fieldErrors.confirmPassword = 'Passwords do not match.';
  }

  if (Object.keys(fieldErrors).length > 0) {
    return res.status(400).json({ fieldErrors });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedUsername = username.trim();

  if (users.some(u => u.email === normalizedEmail)) {
    return res.status(409).json({ fieldErrors: { email: 'Email is already registered.' } });
  }

  if (users.some(u => u.username === normalizedUsername)) {
    return res.status(409).json({ fieldErrors: { username: 'Username is already taken.' } });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  users.push({
    id: crypto.randomUUID(),
    username: normalizedUsername,
    email: normalizedEmail,
    passwordHash,
    createdAt: new Date().toISOString()
  });

  return res.status(201).json({ message: 'User registered successfully.' });
});

module.exports = app;