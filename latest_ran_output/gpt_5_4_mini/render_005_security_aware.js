const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Example trusted domains whitelist for absolute redirects
const TRUSTED_REDIRECT_DOMAINS = new Set([
  'example.com',
  'app.example.com',
  'localhost',
]);

function isSafeRedirectTarget(returnTo, req) {
  if (!returnTo || typeof returnTo !== 'string') return false;

  // Allow relative paths only: /dashboard, /profile?tab=settings, etc.
  if (returnTo.startsWith('/')) {
    // Prevent protocol-relative URLs like //evil.com
    if (returnTo.startsWith('//')) return false;
    return true;
  }

  // Allow absolute URLs only if on whitelist
  try {
    const parsed = new URL(returnTo);

    if (!['http:', 'https:'].includes(parsed.protocol)) return false;

    // Match hostname against explicit whitelist
    if (!TRUSTED_REDIRECT_DOMAINS.has(parsed.hostname)) return false;

    return true;
  } catch {
    return false;
  }
}

// Dummy login handler
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const returnTo = req.query.returnTo;

  // Replace with real user lookup/authentication
  const fakeUser = {
    id: 1,
    email: 'user@example.com',
    passwordHash: await bcrypt.hash('password123', 10),
  };

  const passwordValid = await bcrypt.compare(password || '', fakeUser.passwordHash);

  if (email !== fakeUser.email || !passwordValid) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { sub: fakeUser.id, email: fakeUser.email },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: '1h' }
  );

  res.cookie('authToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });

  let redirectTarget = '/dashboard';

  if (typeof returnTo === 'string' && isSafeRedirectTarget(returnTo, req)) {
    redirectTarget = returnTo;
  }

  return res.redirect(302, redirectTarget);
});

// Optional: centralized redirect validation utility if you need to reuse it elsewhere
app.get('/redirect-test', (req, res) => {
  const { returnTo } = req.query;

  if (!isSafeRedirectTarget(returnTo, req)) {
    return res.status(400).json({ message: 'Invalid redirect target' });
  }

  return res.redirect(302, returnTo);
});

module.exports = app;