const express = require('express');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');

const app = express();
app.use(cookieParser());
app.use(express.json());

// In-memory server-side store: token (hashed) -> { userId, series, expiresAt }
// In production replace with a persistent DB (Redis, SQL, etc.)
const rememberMeStore = new Map();

const REMEMBER_ME_COOKIE = 'remember_me';
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

// Hash a raw token before storing it so DB leaks don't expose usable tokens.
function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

// Generate a cryptographically strong random value.
function generateRandom(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

// Cookie attributes: HttpOnly, Secure, SameSite=Strict.
function cookieOptions() {
  return {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: TOKEN_TTL_MS,
  };
}

// Create/issue a new remember-me cookie for a user.
function issueRememberMeToken(res, userId, series = null) {
  const rawToken = generateRandom(32);
  const tokenSeries = series || generateRandom(16);
  const hashed = hashToken(rawToken);

  rememberMeStore.set(hashed, {
    userId,
    series: tokenSeries,
    expiresAt: Date.now() + TOKEN_TTL_MS,
  });

  // Cookie value binds the series and the raw token.
  const cookieValue = `${tokenSeries}:${rawToken}`;
  res.cookie(REMEMBER_ME_COOKIE, cookieValue, cookieOptions());

  return { rawToken, tokenSeries, hashed };
}

// Remove a token from the store.
function revokeToken(hashed) {
  rememberMeStore.delete(hashed);
}

// Revoke all tokens for a given series (used on theft detection).
function revokeSeries(series) {
  for (const [hashed, record] of rememberMeStore.entries()) {
    if (record.series === series) {
      rememberMeStore.delete(hashed);
    }
  }
}

function clearRememberMeCookie(res) {
  res.clearCookie(REMEMBER_ME_COOKIE, { path: '/' });
}

// Validate a remember-me cookie, rotating the token on each successful use.
function validateAndRotate(req, res) {
  const cookie = req.cookies?.[REMEMBER_ME_COOKIE];
  if (!cookie || typeof cookie !== 'string' || !cookie.includes(':')) {
    return { valid: false };
  }

  const [series, rawToken] = cookie.split(':');
  if (!series || !rawToken) {
    return { valid: false };
  }

  const hashed = hashToken(rawToken);
  const record = rememberMeStore.get(hashed);

  // Token not found: possible theft or already-rotated token reuse.
  if (!record) {
    // If any token exists for this series, the presented token is stale/stolen.
    revokeSeries(series);
    clearRememberMeCookie(res);
    return { valid: false, theftSuspected: true };
  }

  // Series mismatch or expiry check.
  if (record.series !== series || record.expiresAt < Date.now()) {
    revokeToken(hashed);
    revokeSeries(series);
    clearRememberMeCookie(res);
    return { valid: false };
  }

  const userId = record.userId;

  // Rotate: invalidate old token, issue a fresh one keeping the same series.
  revokeToken(hashed);
  issueRememberMeToken(res, userId, series);

  return { valid: true, userId };
}

// ---- Example route wiring ----

// On login with "remember me" checked.
app.post('/login', (req, res) => {
  const { userId, rememberMe } = req.body; // authenticate user first (omitted)
  if (!userId) return res.status(401).json({ error: 'invalid credentials' });

  if (rememberMe) {
    issueRememberMeToken(res, userId);
  }
  res.json({ ok: true });
});

// Auto-login using the remember-me cookie.
app.get('/auto-login', (req, res) => {
  const result = validateAndRotate(req, res);
  if (!result.valid) {
    return res.status(401).json({
      error: 'not authenticated',
      theftSuspected: !!result.theftSuspected,
    });
  }
  // Establish a session for result.userId here.
  res.json({ ok: true, userId: result.userId });
});

// Logout clears and revokes the remember-me token.
app.post('/logout', (req, res) => {
  const cookie = req.cookies?.[REMEMBER_ME_COOKIE];
  if (cookie && cookie.includes(':')) {
    const [, rawToken] = cookie.split(':');
    revokeToken(hashToken(rawToken));
  }
  clearRememberMeCookie(res);
  res.json({ ok: true });
});

module.exports = {
  app,
  issueRememberMeToken,
  validateAndRotate,
  revokeToken,
  revokeSeries,
  clearRememberMeCookie,
  hashToken,
};