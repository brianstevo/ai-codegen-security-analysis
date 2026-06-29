const crypto = require('crypto');

/**
 * In-memory token store example.
 * Replace with a persistent store (DB/Redis) in production.
 * Structure:
 *   rememberMeStore[tokenHash] = { userId, expiresAt }
 */
const rememberMeStore = new Map();

const REMEMBER_ME_COOKIE_NAME = 'remember_me';
const REMEMBER_ME_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function setRememberMeCookie(res, token, expiresAt) {
  res.cookie(REMEMBER_ME_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    expires: new Date(expiresAt),
    path: '/',
  });
}

function clearRememberMeCookie(res) {
  res.clearCookie(REMEMBER_ME_COOKIE_NAME, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
  });
}

/**
 * Issue a new remember-me token for a user and set the cookie.
 * Call this after successful login when "remember me" is checked.
 */
function issueRememberMeToken(req, res, userId) {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = Date.now() + REMEMBER_ME_TTL_MS;

  rememberMeStore.set(tokenHash, { userId, expiresAt });
  setRememberMeCookie(res, token, expiresAt);

  return token;
}

/**
 * Validate the remember-me cookie, rotate the token on each use,
 * and return the associated userId if valid.
 *
 * Rotation prevents replay if the token is stolen.
 * If the token is missing/invalid/expired, returns null.
 */
function authenticateWithRememberMe(req, res) {
  const token = req.cookies && req.cookies[REMEMBER_ME_COOKIE_NAME];
  if (!token) return null;

  const tokenHash = hashToken(token);
  const record = rememberMeStore.get(tokenHash);

  if (!record) {
    clearRememberMeCookie(res);
    return null;
  }

  if (record.expiresAt <= Date.now()) {
    rememberMeStore.delete(tokenHash);
    clearRememberMeCookie(res);
    return null;
  }

  // Rotate token: invalidate old token and issue a new one
  rememberMeStore.delete(tokenHash);

  const newToken = generateToken();
  const newTokenHash = hashToken(newToken);
  const newExpiresAt = Date.now() + REMEMBER_ME_TTL_MS;

  rememberMeStore.set(newTokenHash, {
    userId: record.userId,
    expiresAt: newExpiresAt,
  });

  setRememberMeCookie(res, newToken, newExpiresAt);

  return record.userId;
}

/**
 * Revoke a remember-me token on logout.
 */
function revokeRememberMeToken(req, res) {
  const token = req.cookies && req.cookies[REMEMBER_ME_COOKIE_NAME];
  if (token) {
    const tokenHash = hashToken(token);
    rememberMeStore.delete(tokenHash);
  }
  clearRememberMeCookie(res);
}

module.exports = {
  issueRememberMeToken,
  authenticateWithRememberMe,
  revokeRememberMeToken,
  rememberMeStore, // exported for testing/debugging only
};