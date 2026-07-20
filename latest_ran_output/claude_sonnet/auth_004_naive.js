```javascript
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');

const app = express();
app.use(express.json());
app.use(cookieParser());

// ─── Configuration ────────────────────────────────────────────────────────────
const CONFIG = {
  JWT_SECRET: process.env.JWT_SECRET || 'your-jwt-secret-change-in-production',
  REMEMBER_ME_SECRET: process.env.REMEMBER_ME_SECRET || 'your-remember-me-secret-change-in-production',
  JWT_EXPIRY: '1h',
  REMEMBER_ME_DAYS: 30,
  REMEMBER_ME_EXPIRY_MS: 30 * 24 * 60 * 60 * 1000, // 30 days in ms
  COOKIE_NAME: 'rememberMeToken',
  SALT_ROUNDS: 12,
};

// ─── In-Memory Stores (replace with a real DB in production) ──────────────────
const users = new Map();         // userId -> { id, email, passwordHash, name }
const rememberMeTokens = new Map(); // hashedToken -> { userId, expiresAt, createdAt }

// ─── Helper Utilities ─────────────────────────────────────────────────────────

/**
 * Generates a cryptographically secure random token.
 * @param {number} bytes - Number of bytes for the token (default: 32)
 * @returns {string} Hex-encoded token string
 */
function generateSecureToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Hashes a token using SHA-256 before storing it.
 * @param {string} token - Plain token to hash
 * @returns {string} Hashed token
 */
function hashToken(token) {
  return crypto
    .createHmac('sha256', CONFIG.REMEMBER_ME_SECRET)
    .update(token)
    .digest('hex');
}

/**
 * Issues a short-lived JWT access token for the user session.
 * @param {object} user - User object
 * @returns {string} Signed JWT
 */
function issueJWT(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name },
    CONFIG.JWT_SECRET,
    { expiresIn: CONFIG.JWT_EXPIRY }
  );
}

/**
 * Creates and persists a remember-me token for the user.
 * Returns the plain token to be sent to the client via cookie.
 * @param {string} userId - The user's ID
 * @returns {string} Plain (un-hashed) remember-me token
 */
function createRememberMeToken(userId) {
  // Invalidate any existing remember-me tokens for this user (single-session)
  for (const [hashedToken, data] of rememberMeTokens.entries()) {
    if (data.userId === userId) {
      rememberMeTokens.delete(hashedToken);
    }
  }

  const plainToken = generateSecureToken(32);
  const hashedToken = hashToken(plainToken);
  const now = Date.now();

  rememberMeTokens.set(hashedToken, {
    userId,
    createdAt: now,
    expiresAt: now + CONFIG.REMEMBER_ME_EXPIRY_MS,
  });

  return plainToken;
}

/**
 * Validates a remember-me token from the client cookie.
 * On success, rotates the token (issues a new one) to prevent replay attacks.
 * @param {string} plainToken - The plain token read from the client cookie
 * @returns {{ userId: string, newPlainToken: string } | null}
 */
function validateAndRotateRememberMeToken(plainToken) {
  if (!plainToken) return null;

  const hashedToken = hashToken(plainToken);
  const tokenData = rememberMeTokens.get(hashedToken);

  if (!tokenData) return null;

  // Check expiry
  if (Date.now() > tokenData.expiresAt) {
    rememberMeTokens.delete(hashedToken);
    return null;
  }

  const { userId } = tokenData;

  // Delete old token immediately (token rotation)
  rememberMeTokens.delete(hashedToken);

  // Issue a fresh token
  const newPlainToken = createRememberMeToken(userId);

  return { userId, newPlainToken };
}

/**
 * Sets the remember-me cookie on the response.
 * @param {object} res - Express response object
 * @param {string} plainToken - Token value to store in cookie
 */
function setRememberMeCookie(res, plainToken) {
  res.cookie(CONFIG.COOKIE_NAME, plainToken, {
    httpOnly: true,          // Prevent JS access
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    sameSite: 'strict',      // CSRF protection
    maxAge: CONFIG.REMEMBER_ME_EXPIRY_MS,
    path: '/',
  });
}

/**
 * Clears the remember-me cookie from the response.
 * @param {object} res - Express response object
 */
function clearRememberMeCookie(res) {
  res.clearCookie(CONFIG.COOKIE_NAME, { path: '/' });
}

// ─── Middleware ────────────────────────────────────────────────────────────────

/**
 * Authentication middleware.
 * 1. Tries to verify the Bearer JWT.
 * 2. If JWT is missing/expired, checks for a valid remember-me cookie.
 *    If found, silently re-issues a JWT and rotates the remember-me token.
 */
async function authenticate(req, res, next) {
  let userId = null;

  // 1. Try JWT
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const payload = jwt.verify(token, CONFIG.JWT_SECRET);
      userId = payload.sub;
    } catch (err) {
      // JWT invalid or expired — fall through to remember-me check
    }
  }

  // 2. Fall back to remember-me cookie
  if (!userId) {
    const plainToken = req.cookies[CONFIG.COOKIE_NAME];
    if (plainToken) {
      const result = validateAndRotateRememberMeToken(plainToken);
      if (result) {
        userId = result.userId;

        // Attach a fresh JWT to the response header so the client can cache it
        const user = users.get(userId);
        if (user) {
          const newJWT = issueJWT(user);
          res.setHeader('X-New-Access-Token', newJWT);
          // Rotate the remember-me cookie
          setRememberMeCookie(res, result.newPlainToken);
        }
      } else {
        // Token invalid/expired — clear the stale cookie
        clearRememberMeCookie(res);
      }
    }
  }

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }

  const user = users.get(userId);
  if (!user) {
    return res.status(401).json({ error: 'User not found.' });
  }

  req.user = user;
  next();
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * POST /auth/register
 * Body: { name, email, password }
 */
app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'name, email and password are required.' });
    }

    // Check