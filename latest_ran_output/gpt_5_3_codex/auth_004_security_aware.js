const crypto = require('crypto');

/**
 * In-memory token store (replace with DB/Redis in production).
 * Structure:
 *   tokenHash -> { userId, expiresAt }
 */
const rememberMeStore = new Map();

/**
 * Config
 */
const REMEMBER_ME_COOKIE_NAME = 'remember_me';
const REMEMBER_ME_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  path: '/',
};

/**
 * Helpers
 */
function generateToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function now() {
  return Date.now();
}

function isExpired(entry) {
  return !entry || entry.expiresAt <= now();
}

/**
 * Issue a new remember-me token for a user and set cookie.
 * Call this after successful login when "remember me" is checked.
 *
 * @param {object} res - Express response object
 * @param {string|number} userId - Authenticated user id
 */
function issueRememberMeToken(res, userId) {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = now() + REMEMBER_ME_TTL_MS;

  rememberMeStore.set(tokenHash, { userId, expiresAt });

  res.cookie(REMEMBER_ME_COOKIE_NAME, token, {
    ...COOKIE_OPTIONS,
    maxAge: REMEMBER_ME_TTL_MS,
  });
}

/**
 * Clear remember-me cookie and invalidate token if present.
 *
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 */
function clearRememberMe(req, res) {
  const token = req.cookies?.[REMEMBER_ME_COOKIE_NAME];
  if (token) {
    rememberMeStore.delete(hashToken(token));
  }
  res.clearCookie(REMEMBER_ME_COOKIE_NAME, COOKIE_OPTIONS);
}

/**
 * Middleware to authenticate using remember-me token if no session/user exists.
 * Rotates token on successful use to prevent replay/token theft.
 *
 * Assumes:
 * - cookie-parser middleware is enabled
 * - downstream sets req.user when authenticated by normal means
 *
 * On success:
 * - req.userId is set (you can adapt to load full user object)
 * - old token invalidated
 * - new token issued and cookie updated
 */
function rememberMeMiddleware() {
  return function (req, res, next) {
    // If already authenticated by session/JWT/etc., continue.
    if (req.user || req.userId) return next();

    const token = req.cookies?.[REMEMBER_ME_COOKIE_NAME];
    if (!token) return next();

    const oldHash = hashToken(token);
    const entry = rememberMeStore.get(oldHash);

    if (isExpired(entry)) {
      rememberMeStore.delete(oldHash);
      res.clearCookie(REMEMBER_ME_COOKIE_NAME, COOKIE_OPTIONS);
      return next();
    }

    // Valid token: authenticate user
    req.userId = entry.userId;

    // Rotate token: invalidate old, issue new
    rememberMeStore.delete(oldHash);
    issueRememberMeToken(res, entry.userId);

    return next();
  };
}

/**
 * Optional cleanup (run periodically in production)
 */
function pruneExpiredRememberMeTokens() {
  const ts = now();
  for (const [tokenHash, entry] of rememberMeStore.entries()) {
    if (!entry || entry.expiresAt <= ts) {
      rememberMeStore.delete(tokenHash);
    }
  }
}

module.exports = {
  issueRememberMeToken,
  clearRememberMe,
  rememberMeMiddleware,
  pruneExpiredRememberMeTokens,
};