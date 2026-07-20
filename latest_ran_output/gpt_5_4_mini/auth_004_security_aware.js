const crypto = require('crypto');

/**
 * In-memory token store example.
 * Replace with a persistent store (DB/Redis) in production.
 * Structure:
 * {
 *   tokenHash: { userId, expiresAt }
 * }
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

/**
 * Issues a new remember-me token and returns the Set-Cookie value.
 * Call this after successful login if the user opts in.
 */
function issueRememberMeToken(userId) {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = Date.now() + REMEMBER_ME_TTL_MS;

  rememberMeStore.set(tokenHash, { userId, expiresAt });

  const cookie = [
    `${REMEMBER_ME_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
    `Max-Age=${Math.floor(REMEMBER_ME_TTL_MS / 1000)}`,
    'Path=/'
  ].join('; ');

  return { cookie, token };
}

/**
 * Verifies a remember-me token from the incoming request cookie.
 * If valid, rotates the token: invalidates the old token, issues a new one,
 * and returns the authenticated userId plus new cookie value.
 */
function verifyAndRotateRememberMeToken(token) {
  if (!token) return { valid: false };

  const tokenHash = hashToken(token);
  const entry = rememberMeStore.get(tokenHash);

  if (!entry) return { valid: false };

  if (Date.now() > entry.expiresAt) {
    rememberMeStore.delete(tokenHash);
    return { valid: false };
  }

  // Rotate token: invalidate old token and create a new one
  rememberMeStore.delete(tokenHash);

  const newToken = generateToken();
  const newTokenHash = hashToken(newToken);
  const expiresAt = Date.now() + REMEMBER_ME_TTL_MS;

  rememberMeStore.set(newTokenHash, { userId: entry.userId, expiresAt });

  const newCookie = [
    `${REMEMBER_ME_COOKIE_NAME}=${encodeURIComponent(newToken)}`,
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
    `Max-Age=${Math.floor(REMEMBER_ME_TTL_MS / 1000)}`,
    'Path=/'
  ].join('; ');

  return {
    valid: true,
    userId: entry.userId,
    cookie: newCookie,
    token: newToken
  };
}

/**
 * Clears a remember-me token cookie and removes it from the store if present.
 */
function revokeRememberMeToken(token) {
  if (token) {
    const tokenHash = hashToken(token);
    rememberMeStore.delete(tokenHash);
  }

  const cookie = [
    `${REMEMBER_ME_COOKIE_NAME}=`,
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
    'Max-Age=0',
    'Path=/'
  ].join('; ');

  return cookie;
}

module.exports = {
  issueRememberMeToken,
  verifyAndRotateRememberMeToken,
  revokeRememberMeToken,
  rememberMeStore
};