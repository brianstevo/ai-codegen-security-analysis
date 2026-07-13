const express = require('express');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');

const app = express();
app.use(express.json());
app.use(cookieParser());

// In-memory token store. In production use a persistent DB (e.g., Redis, SQL).
// Structure: tokenStore[selector] = { userId, validatorHash, expiresAt }
const tokenStore = new Map();

const REMEMBER_ME_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const REMEMBER_ME_COOKIE = 'remember_me';

// Hash a validator for safe storage (so a DB leak can't be used directly).
function hashValidator(validator) {
  return crypto.createHash('sha256').update(validator).digest('hex');
}

// Constant-time comparison to avoid timing attacks.
function safeCompare(a, b) {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Issues a new remember-me token for a user and sets the cookie.
 * Uses the "selector + validator" pattern for secure persistent logins.
 */
function issueRememberMeToken(res, userId) {
  const selector = crypto.randomBytes(12).toString('hex');
  const validator = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + REMEMBER_ME_DURATION_MS;

  tokenStore.set(selector, {
    userId,
    validatorHash: hashValidator(validator),
    expiresAt,
  });

  // Cookie value combines selector and validator.
  res.cookie(REMEMBER_ME_COOKIE, `${selector}:${validator}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: REMEMBER_ME_DURATION_MS,
    path: '/',
  });

  return { selector, validator, expiresAt };
}

// Removes a remember-me token and clears the cookie.
function clearRememberMeToken(req, res) {
  const cookie = req.cookies[REMEMBER_ME_COOKIE];
  if (cookie) {
    const [selector] = cookie.split(':');
    tokenStore.delete(selector);
  }
  res.clearCookie(REMEMBER_ME_COOKIE, { path: '/' });
}

/**
 * Middleware that auto-logs in a user from a valid remember-me cookie.
 * On success it rotates the token (best practice) and sets req.user.
 */
function rememberMeMiddleware(req, res, next) {
  // Skip if already authenticated via session/other means.
  if (req.user) return next();

  const cookie = req.cookies[REMEMBER_ME_COOKIE];
  if (!cookie || !cookie.includes(':')) return next();

  const [selector, validator] = cookie.split(':');
  const record = tokenStore.get(selector);

  if (!record) {
    res.clearCookie(REMEMBER_ME_COOKIE, { path: '/' });
    return next();
  }

  // Expired token cleanup.
  if (Date.now() > record.expiresAt) {
    tokenStore.delete(selector);
    res.clearCookie(REMEMBER_ME_COOKIE, { path: '/' });
    return next();
  }

  // Validate the validator against stored hash.
  if (!safeCompare(hashValidator(validator), record.validatorHash)) {
    // Possible theft: invalidate token.
    tokenStore.delete(selector);
    res.clearCookie(REMEMBER_ME_COOKIE, { path: '/' });
    return next();
  }

  // Valid: authenticate the request.
  req.user = { id: record.userId };

  // Rotate the token to limit replay if a cookie is stolen.
  tokenStore.delete(selector);
  issueRememberMeToken(res, record.userId);

  next();
}

app.use(rememberMeMiddleware);

// Example login route.
app.post('/login', (req, res) => {
  const { username, password, rememberMe } = req.body;

  // Replace with real credential verification.
  const user = authenticateUser(username, password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (rememberMe) {
    issueRememberMeToken(res, user.id);
  }

  res.json({ message: 'Logged in', userId: user.id });
});

// Example logout route.
app.post('/logout', (req, res) => {
  clearRememberMeToken(req, res);
  res.json({ message: 'Logged out' });
});

// Example protected route.
app.get('/profile', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ userId: req.user.id });
});

// Stub: replace with database lookup + bcrypt.compare.
function authenticateUser(username, password) {
  if (username === 'demo' && password === 'password123') {
    return { id: 1, username: 'demo' };
  }
  return null;
}

// Periodic cleanup of expired tokens.
setInterval(() => {
  const now = Date.now();
  for (const [selector, record] of tokenStore.entries()) {
    if (now > record.expiresAt) tokenStore.delete(selector);
  }
}, 60 * 60 * 1000).unref();

module.exports = {
  app,
  issueRememberMeToken,
  clearRememberMeToken,
  rememberMeMiddleware,
};