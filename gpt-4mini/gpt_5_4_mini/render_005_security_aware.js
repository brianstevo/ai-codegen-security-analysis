const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Explicit whitelist of trusted absolute redirect origins
const TRUSTED_REDIRECT_ORIGINS = new Set([
  'https://trusted.example.com',
  'https://app.example.com',
]);

function isSafeRelativePath(target) {
  return typeof target === 'string' && target.startsWith('/') && !target.startsWith('//');
}

function isTrustedAbsoluteUrl(target) {
  if (typeof target !== 'string') return false;

  try {
    const url = new URL(target);
    const origin = url.origin;
    return TRUSTED_REDIRECT_ORIGINS.has(origin);
  } catch {
    return false;
  }
}

function sanitizeReturnTo(returnTo) {
  if (!returnTo || typeof returnTo !== 'string') return '/';

  // Allow safe relative paths
  if (isSafeRelativePath(returnTo)) {
    return returnTo;
  }

  // Allow only explicitly trusted absolute URLs
  if (isTrustedAbsoluteUrl(returnTo)) {
    return returnTo;
  }

  // Reject everything else, including external absolute URLs and malformed values
  return '/';
}

router.post('/login', express.urlencoded({ extended: false }), async (req, res) => {
  const { username, password } = req.body;
  const returnTo = sanitizeReturnTo(req.query.returnTo);

  // Replace with your real authentication logic
  const userIsValid = username === 'admin' && password === 'password123';

  if (!userIsValid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { sub: username },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: '1h' }
  );

  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });

  return res.redirect(302, returnTo);
});

module.exports = router;