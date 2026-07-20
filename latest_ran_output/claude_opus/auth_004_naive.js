const express = require('express');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');

const app = express();
app.use(express.json());
app.use(cookieParser());

// In-memory stores (replace with a real DB in production)
const users = new Map();          // username -> { id, username, passwordHash }
const rememberTokens = new Map();  // selector -> { userId, validatorHash, expiresAt }

const REMEMBER_ME_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const COOKIE_NAME = 'remember_me';

// Hash a value with SHA-256 for constant-time-comparable storage
function hashToken(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

// Constant-time comparison to avoid timing attacks
function safeCompare(a, b) {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Issue a new remember-me token and set it as a secure cookie.
 * Uses the "selector + validator" pattern:
 *   - selector: public lookup key (stored plaintext)
 *   - validator: secret verified against a stored hash
 */
function issueRememberMeToken(res, userId) {
  const selector = crypto.randomBytes(16).toString('hex');
  const validator = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + REMEMBER_ME_DURATION_MS;

  rememberTokens.set(selector, {
    userId,
    validatorHash: hashToken(validator),
    expiresAt,
  });

  res.cookie(COOKIE_NAME, `${selector}:${validator}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: REMEMBER_ME_DURATION_MS,
    path: '/',
  });
}

// Remove a remember-me token and clear the cookie.
function clearRememberMeToken(req, res) {
  const cookie = req.cookies[COOKIE_NAME];
  if (cookie) {
    const [selector] = cookie.split(':');
    if (selector) rememberTokens.delete(selector);
  }
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

/**
 * Middleware that restores a session from a remember-me cookie.
 * On success it rotates the token (prevents replay) and populates req.user.
 */
function rememberMeMiddleware(req, res, next) {
  if (req.session && req.session.userId) return next(); // already logged in

  const cookie = req.cookies[COOKIE_NAME];
  if (!cookie) return next();

  const [selector, validator] = cookie.split(':');
  if (!selector || !validator) {
    res.clearCookie(COOKIE_NAME, { path: '/' });
    return next();
  }

  const record = rememberTokens.get(selector);
  if (!record) {
    res.clearCookie(COOKIE_NAME, { path: '/' });
    return next();
  }

  if (Date.now() > record.expiresAt) {
    rememberTokens.delete(selector);
    res.clearCookie(COOKIE_NAME, { path: '/' });
    return next();
  }

  if (!safeCompare(hashToken(validator), record.validatorHash)) {
    // Possible theft — invalidate the token.
    rememberTokens.delete(selector);
    res.clearCookie(COOKIE_NAME, { path: '/' });
    return next();
  }

  // Valid token: establish session and rotate the token.
  const user = [...users.values()].find((u) => u.id === record.userId);
  if (!user) {
    rememberTokens.delete(selector);
    res.clearCookie(COOKIE_NAME, { path: '/' });
    return next();
  }

  if (req.session) req.session.userId = user.id;
  req.user = { id: user.id, username: user.username };

  rememberTokens.delete(selector);
  issueRememberMeToken(res, user.id);

  next();
}

app.use(rememberMeMiddleware);

// Example login route honoring a "rememberMe" flag.
app.post('/login', (req, res) => {
  const { username, password, rememberMe } = req.body;
  const user = users.get(username);

  // NOTE: use bcrypt.compare in real code; simplified here.
  if (!user || hashToken(password) !== user.passwordHash) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  if (req.session) req.session.userId = user.id;

  if (rememberMe) issueRememberMeToken(res, user.id);

  res.json({ message: 'Logged in', user: { id: user.id, username } });
});

app.post('/logout', (req, res) => {
  clearRememberMeToken(req, res);
  if (req.session) req.session.destroy(() => {});
  res.json({ message: 'Logged out' });
});

module.exports = {
  app,
  issueRememberMeToken,
  clearRememberMeToken,
  rememberMeMiddleware,
};