const crypto = require('crypto');

/**
 * In-memory token store (replace with DB/Redis in production)
 * tokenHash -> { userId, expiresAt }
 */
const rememberTokenStore = new Map();

const REMEMBER_COOKIE_NAME = 'remember_me';
const REMEMBER_TOKEN_BYTES = 32; // 256-bit token
const REMEMBER_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateRawToken() {
  return crypto.randomBytes(REMEMBER_TOKEN_BYTES).toString('base64url');
}

function setRememberMeCookie(res, token, maxAgeMs = REMEMBER_TTL_MS) {
  res.cookie(REMEMBER_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: maxAgeMs,
  });
}

function clearRememberMeCookie(res) {
  res.clearCookie(REMEMBER_COOKIE_NAME, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
  });
}

/**
 * Issue remember-me token after successful login
 */
async function issueRememberMeToken(res, userId) {
  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);

  rememberTokenStore.set(tokenHash, {
    userId,
    expiresAt: Date.now() + REMEMBER_TTL_MS,
  });

  setRememberMeCookie(res, rawToken);
}

/**
 * Validate and rotate remember-me token.
 * Returns userId if valid and rotated; otherwise null.
 */
async function validateAndRotateRememberMeToken(req, res) {
  const rawToken = req.cookies?.[REMEMBER_COOKIE_NAME];
  if (!rawToken) return null;

  const oldHash = hashToken(rawToken);
  const record = rememberTokenStore.get(oldHash);

  if (!record || record.expiresAt < Date.now()) {
    rememberTokenStore.delete(oldHash);
    clearRememberMeCookie(res);
    return null;
  }

  // Rotate token: delete old, issue new
  rememberTokenStore.delete(oldHash);

  const newRawToken = generateRawToken();
  const newHash = hashToken(newRawToken);

  rememberTokenStore.set(newHash, {
    userId: record.userId,
    expiresAt: Date.now() + REMEMBER_TTL_MS,
  });

  setRememberMeCookie(res, newRawToken);
  return record.userId;
}

/**
 * Revoke remember-me token (logout)
 */
async function revokeRememberMeToken(req, res) {
  const rawToken = req.cookies?.[REMEMBER_COOKIE_NAME];
  if (rawToken) {
    rememberTokenStore.delete(hashToken(rawToken));
  }
  clearRememberMeCookie(res);
}

module.exports = {
  issueRememberMeToken,
  validateAndRotateRememberMeToken,
  revokeRememberMeToken,
  REMEMBER_COOKIE_NAME,
};