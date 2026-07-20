```javascript
const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');

const app = express();
app.use(express.json());
app.use(cookieParser());

// In-memory stores (replace with database in production)
const users = new Map();
const rememberMeTokens = new Map(); // token -> { userId, hashedToken, expiresAt }

const REMEMBER_ME_COOKIE = 'remember_me';
const TOKEN_EXPIRY_DAYS = 30;
const TOKEN_BYTES = 32;
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'Strict',
  maxAge: TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  path: '/',
};

/**
 * Generate a cryptographically secure random token
 */
function generateToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString('hex');
}

/**
 * Hash a token for secure storage (prevents token theft from DB compromise)
 */
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Store a new remember-me token for a user
 */
async function storeRememberMeToken(userId) {
  const selector = generateToken(); // public identifier
  const validator = generateToken(); // secret validator
  const hashedValidator = hashToken(validator);
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  // Remove any existing tokens for this user (single session per user)
  for (const [key, value] of rememberMeTokens.entries()) {
    if (value.userId === userId) {
      rememberMeTokens.delete(key);
    }
  }

  rememberMeTokens.set(selector, {
    userId,
    hashedValidator,
    expiresAt,
    createdAt: new Date(),
  });

  // Cookie value format: selector:validator
  return `${selector}:${validator}`;
}

/**
 * Validate and rotate a remember-me token
 * Returns userId on success, null on failure
 * Deletes token on any validation failure (security: possible theft attempt)
 */
async function validateAndRotateToken(cookieValue) {
  if (!cookieValue || typeof cookieValue !== 'string') {
    return null;
  }

  const parts = cookieValue.split(':');
  if (parts.length !== 2) {
    return null;
  }

  const [selector, validator] = parts;

  if (!selector || !validator) {
    return null;
  }

  const tokenData = rememberMeTokens.get(selector);

  if (!tokenData) {
    return null;
  }

  // Check expiry
  if (new Date() > tokenData.expiresAt) {
    rememberMeTokens.delete(selector);
    return null;
  }

  const hashedValidator = hashToken(validator);

  // Use timing-safe comparison to prevent timing attacks
  const expectedBuffer = Buffer.from(tokenData.hashedValidator, 'hex');
  const actualBuffer = Buffer.from(hashedValidator, 'hex');

  if (
    expectedBuffer.length !== actualBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    // Possible theft attempt - invalidate the token immediately
    rememberMeTokens.delete(selector);
    console.warn(`[SECURITY] Token validation failed for selector: ${selector}. Possible theft attempt.`);
    return null;
  }

  // Token is valid - rotate it (delete old, create new)
  const userId = tokenData.userId;
  rememberMeTokens.delete(selector);

  const newCookieValue = await storeRememberMeToken(userId);

  return { userId, newCookieValue };
}

/**
 * Clear a remember-me token by cookie value
 */
function clearRememberMeToken(cookieValue) {
  if (!cookieValue) return;

  const parts = cookieValue.split(':');
  if (parts.length === 2) {
    rememberMeTokens.delete(parts[0]);
  }
}

/**
 * Middleware to auto-authenticate via remember-me cookie
 */
async function rememberMeMiddleware(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }

  const cookieValue = req.cookies[REMEMBER_ME_COOKIE];
  if (!cookieValue) {
    return next();
  }

  try {
    const result = await validateAndRotateToken(cookieValue);

    if (!result) {
      // Clear invalid cookie
      res.clearCookie(REMEMBER_ME_COOKIE, { path: '/' });
      return next();
    }

    const { userId, newCookieValue } = result;
    const user = users.get(userId);

    if (!user) {
      res.clearCookie(REMEMBER_ME_COOKIE, { path: '/' });
      return next();
    }

    // Set rotated token cookie
    res.cookie(REMEMBER_ME_COOKIE, newCookieValue, COOKIE_OPTIONS);

    // Attach user to request
    req.rememberMeUser = user;
    req.rememberMeUserId = userId;

    next();
  } catch (err) {
    console.error('Remember-me middleware error:', err);
    res.clearCookie(REMEMBER_ME_COOKIE, { path: '/' });
    next();
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

/**
 * Register a new user
 */
app.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Check if user exists
    for (const user of users.values()) {
      if (user.username === username) {
        return res.status(409).json({ error: 'Username already exists' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const userId = crypto.randomUUID();

    users.set(userId, {
      id: userId,
      username,
      hashedPassword,
      createdAt: new Date(),
    });

    res.status(201).json({ message: 'User registered successfully', userId });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Login with optional remember-me
 */
app.post('/login', async (req, res) => {
  try {
    const { username, password, rememberMe } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    // Find user by username
    let foundUser = null;
    let foundUserId = null;
    for (const [id, user] of users.entries()) {
      if (user.username === username) {
        foundUser = user;
        foundUserId = id;
        break;
      }
    }

    if (!foundUser) {
      // Perform dummy bcrypt to prevent timing attacks
      await bcrypt.compare(password, '$2b$12$invalidhashfortimingnormalization');
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const passwordMatch = await bcrypt.compare(password, foundUser.hashedPassword);
    if (!passwordMatch) {
      return res.status(401).json({ error