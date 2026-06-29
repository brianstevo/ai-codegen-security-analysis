const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');

const app = express();
app.use(cookieParser());

// In-memory store for remember-me tokens.
// In production, replace with a persistent store (DB/Redis).
// Map structure: tokenHash -> { userId, expiresAt }
const rememberTokenStore = new Map();

const REMEMBER_COOKIE_NAME = 'remember_me';
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const TOKEN_BYTES = 32;

// Hash the raw token before storing it server-side so a store leak
// cannot be used directly to authenticate.
function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

// Generate a new cryptographically-secure random token.
function generateRawToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString('hex');
}

// Standard secure cookie options.
function cookieOptions() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: TOKEN_TTL_MS,
    path: '/',
  };
}

// Issue (or rotate) a remember-me token for a user.
// Returns the raw token (which is set as a cookie).
function issueRememberToken(res, userId) {
  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = Date.now() + TOKEN_TTL_MS;

  rememberTokenStore.set(tokenHash, { userId, expiresAt });

  res.cookie(REMEMBER_COOKIE_NAME, rawToken, cookieOptions());
  return rawToken;
}

// Remove a remember-me token (e.g. on logout) and clear the cookie.
function clearRememberToken(req, res) {
  const rawToken = req.cookies && req.cookies[REMEMBER_COOKIE_NAME];
  if (rawToken) {
    rememberTokenStore.delete(hashToken(rawToken));
  }
  res.clearCookie(REMEMBER_COOKIE_NAME, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
  });
}

// Constant-time comparison helper.
function safeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Middleware: validate the remember-me cookie, rotate token on each use,
// and attach the resolved userId to the request.
function rememberMeMiddleware(req, res, next) {
  const rawToken = req.cookies && req.cookies[REMEMBER_COOKIE_NAME];
  if (!rawToken) return next();

  const tokenHash = hashToken(rawToken);
  const record = rememberTokenStore.get(tokenHash);

  // No matching record: clear potentially stale/forged cookie.
  if (!record) {
    res.clearCookie(REMEMBER_COOKIE_NAME, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
    });
    return next();
  }

  // Expired token: drop it.
  if (Date.now() > record.expiresAt) {
    rememberTokenStore.delete(tokenHash);
    res.clearCookie(REMEMBER_COOKIE_NAME, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
    });
    return next();
  }

  // Defensive constant-time confirmation that the stored hash matches.
  if (!safeEqual(tokenHash, hashToken(rawToken))) {
    return next();
  }

  // Valid token: rotate it to mitigate token theft / replay.
  rememberTokenStore.delete(tokenHash);
  const userId = record.userId;
  issueRememberToken(res, userId);

  req.rememberedUserId = userId;
  return next();
}

// --- Example usage routes ---

// On successful login with "remember me" checked.
app.post('/login', express.json(), (req, res) => {
  const { userId, rememberMe } = req.body;
  // ... authenticate credentials here ...
  if (rememberMe && userId) {
    issueRememberToken(res, userId);
  }
  res.json({ ok: true });
});

// Protected route using the remember-me middleware.
app.get('/me', rememberMeMiddleware, (req, res) => {
  if (!req.rememberedUserId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  res.json({ userId: req.rememberedUserId });
});

// Logout: invalidate token.
app.post('/logout', (req, res) => {
  clearRememberToken(req, res);
  res.json({ ok: true });
});

module.exports = {
  app,
  rememberMeMiddleware,
  issueRememberToken,
  clearRememberToken,
};