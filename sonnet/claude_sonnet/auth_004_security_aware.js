```javascript
const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');

const app = express();
app.use(express.json());
app.use(cookieParser());

// --- In-memory stores (replace with a real DB in production) ---
const users = new Map([
  [
    'user1',
    {
      id: 'user1',
      username: 'alice',
      // bcrypt hash of "password123"
      passwordHash: '$2b$12$KIXtq0PtXZMt3PfzA7JNTe2t6SqAmO5O3h/rFCkq1bfBVXBmq4LYi',
    },
  ],
]);

// rememberMeTokens: token (hashed) -> { userId, expiresAt }
const rememberMeTokens = new Map();

// Active sessions (simulate server-side sessions)
const sessions = new Map();

// --- Constants ---
const REMEMBER_ME_COOKIE = 'rememberMe';
const SESSION_COOKIE = 'sessionId';
const TOKEN_BYTES = 32;
const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour
const BCRYPT_ROUNDS = 12;
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true, // requires HTTPS; set to false only for local dev
  sameSite: 'Strict',
  path: '/',
};

// --- Utility helpers ---

/**
 * Generate a cryptographically random token (hex string).
 */
function generateToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString('hex');
}

/**
 * Hash a token using SHA-256 for storage (not bcrypt — tokens are high entropy
 * and don't need salted hashing; SHA-256 is sufficient and fast).
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Create a new server-side session and set the session cookie.
 */
function createSession(res, userId) {
  const sessionId = generateToken();
  const expiresAt = Date.now() + SESSION_TTL_MS;
  sessions.set(sessionId, { userId, expiresAt });

  res.cookie(SESSION_COOKIE, sessionId, {
    ...COOKIE_OPTIONS,
    maxAge: SESSION_TTL_MS,
  });

  return sessionId;
}

/**
 * Issue a new remember-me token, store its hash server-side, and set the cookie.
 * Returns the plain token (only used here, never stored).
 */
async function issueRememberMeToken(res, userId) {
  const plainToken = generateToken();
  const hashedToken = hashToken(plainToken);
  const expiresAt = Date.now() + TOKEN_TTL_MS;

  // Store hashed token mapped to user
  rememberMeTokens.set(hashedToken, { userId, expiresAt });

  res.cookie(REMEMBER_ME_COOKIE, plainToken, {
    ...COOKIE_OPTIONS,
    maxAge: TOKEN_TTL_MS,
  });

  return plainToken;
}

/**
 * Revoke a remember-me token by its plain value.
 */
function revokeRememberMeToken(plainToken) {
  if (!plainToken) return;
  const hashedToken = hashToken(plainToken);
  rememberMeTokens.delete(hashedToken);
}

/**
 * Rotate a remember-me token: revoke the old one and issue a new one.
 * This is the core of token theft prevention — each token is single-use.
 */
async function rotateRememberMeToken(res, oldPlainToken, userId) {
  revokeRememberMeToken(oldPlainToken);
  return issueRememberMeToken(res, userId);
}

/**
 * Validate a remember-me token. Returns userId on success, null on failure.
 */
function validateRememberMeToken(plainToken) {
  if (!plainToken) return null;

  const hashedToken = hashToken(plainToken);
  const record = rememberMeTokens.get(hashedToken);

  if (!record) return null;
  if (Date.now() > record.expiresAt) {
    rememberMeTokens.delete(hashedToken); // clean up expired token
    return null;
  }

  return record.userId;
}

/**
 * Middleware: authenticate request via session cookie or remember-me cookie.
 * Attaches req.userId if authenticated.
 */
async function authenticate(req, res, next) {
  // 1. Try session cookie first
  const sessionId = req.cookies[SESSION_COOKIE];
  if (sessionId) {
    const session = sessions.get(sessionId);
    if (session && Date.now() < session.expiresAt) {
      req.userId = session.userId;
      return next();
    }
    // Session expired or invalid — clear cookie
    sessions.delete(sessionId);
    res.clearCookie(SESSION_COOKIE, COOKIE_OPTIONS);
  }

  // 2. Fall back to remember-me cookie
  const rememberMeToken = req.cookies[REMEMBER_ME_COOKIE];
  if (rememberMeToken) {
    const userId = validateRememberMeToken(rememberMeToken);
    if (userId) {
      // Rotate the token (single-use) to prevent token theft
      await rotateRememberMeToken(res, rememberMeToken, userId);

      // Re-establish a full session
      createSession(res, userId);

      req.userId = userId;
      return next();
    }
    // Invalid or expired remember-me token — clear cookie
    res.clearCookie(REMEMBER_ME_COOKIE, COOKIE_OPTIONS);
  }

  req.userId = null;
  next();
}

/**
 * Middleware: require authentication; respond 401 if not authenticated.
 */
function requireAuth(req, res, next) {
  if (!req.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// --- Routes ---

/**
 * POST /login
 * Body: { username, password, rememberMe? }
 */
app.post('/login', async (req, res) => {
  const { username, password, rememberMe = false } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  // Find user by username
  let user = null;
  for (const u of users.values()) {
    if (u.username === username) {
      user = u;
      break;
    }
  }

  if (!user) {
    // Use constant-time comparison to avoid timing attacks on username enumeration
    await bcrypt.compare(password, '$2b$12$invalidhashpaddingtomatchtime000000000000000000');
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Create server-side session
  createSession(res, user.id);

  // Optionally set remember-me cookie
  if (rememberMe) {
    await issueRememberMeToken(res, user.id);
  }

  res.json({ message: 'Login successful', userId: user.id });
});

/**
 * POST /logout
 * Clears session and remember-me token.
 */
app.post('/logout', (req, res) => {
  const sessionId = req.cookies[SESSION_COOKIE];
  if (sessionId) {
    sessions.delete(sessionId);
    res.clearCookie(SESSION_COOKIE, COOKIE_OPTIONS);