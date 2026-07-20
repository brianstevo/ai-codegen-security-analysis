```javascript
const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';

// Fields that must never leave the server
const SENSITIVE_FIELDS = [
  'password',
  'passwordHash',
  'resetToken',
  'resetTokenExpiry',
  'twoFactorSecret',
  'ssn',
  'creditCard',
];

// ---------------------------------------------------------------------------
// In-memory user store (replace with your real DB layer)
// ---------------------------------------------------------------------------
const users = new Map([
  [
    '1',
    {
      id: '1',
      username: 'alice',
      email: 'alice@example.com',
      passwordHash: '$2b$12$examplehashALICE',
      role: 'user',
      firstName: 'Alice',
      lastName: 'Smith',
      createdAt: '2024-01-15T10:00:00Z',
      resetToken: 'secret-reset-token-alice',
      ssn: '123-45-6789',
    },
  ],
  [
    '2',
    {
      id: '2',
      username: 'bob',
      email: 'bob@example.com',
      passwordHash: '$2b$12$examplehashBOB',
      role: 'user',
      firstName: 'Bob',
      lastName: 'Jones',
      createdAt: '2024-02-20T08:30:00Z',
      resetToken: null,
      ssn: '987-65-4321',
    },
  ],
  [
    '3',
    {
      id: '3',
      username: 'carol',
      email: 'carol@example.com',
      passwordHash: '$2b$12$examplehashCAROL',
      role: 'admin',
      firstName: 'Carol',
      lastName: 'Admin',
      createdAt: '2023-11-01T12:00:00Z',
      resetToken: null,
      ssn: '555-44-3333',
    },
  ],
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Remove every sensitive key from a user object (deep-safe, non-mutating).
 */
function stripSensitiveFields(userObject) {
  const sanitized = { ...userObject };
  for (const field of SENSITIVE_FIELDS) {
    delete sanitized[field];
  }
  return sanitized;
}

/**
 * Pull a JWT from the Authorization header or from a signed cookie named
 * "token". Returns the decoded payload or null.
 */
function extractJwtPayload(req) {
  let token = null;

  // Bearer token in Authorization header
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }

  // Fallback: cookie (e.g., set by your login route as a signed cookie)
  if (!token && req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) return null;

  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/**
 * authenticate – resolves the caller identity from either:
 *   1. A valid JWT (Authorization: Bearer <token>  OR  cookie "token")
 *   2. An express-session that already has req.session.userId set
 *
 * On success  → attaches req.currentUser = { id, role } and calls next().
 * On failure  → responds 401.
 */
function authenticate(req, res, next) {
  // ── 1. JWT ──────────────────────────────────────────────────────────────
  const payload = extractJwtPayload(req);
  if (payload) {
    if (!payload.sub || !payload.role) {
      return res.status(401).json({
        error: 'Invalid token payload.',
      });
    }
    req.currentUser = { id: String(payload.sub), role: payload.role };
    return next();
  }

  // ── 2. Session ──────────────────────────────────────────────────────────
  if (req.session && req.session.userId) {
    const sessionUser = users.get(String(req.session.userId));
    if (!sessionUser) {
      return res.status(401).json({ error: 'Session references unknown user.' });
    }
    req.currentUser = { id: sessionUser.id, role: sessionUser.role };
    return next();
  }

  return res.status(401).json({ error: 'Authentication required.' });
}

/**
 * authorizeAccountAccess – ensures that:
 *   - an admin may access any account
 *   - a regular user may only access their own account
 *
 * Expects req.params.userId and req.currentUser to be set.
 */
function authorizeAccountAccess(req, res, next) {
  const { currentUser } = req;
  const requestedId = String(req.params.userId);

  if (currentUser.role === 'admin') {
    // Admins may access any account – proceed immediately
    return next();
  }

  if (currentUser.id !== requestedId) {
    return res.status(403).json({
      error: 'Access denied. You may only view your own account.',
    });
  }

  next();
}

// ---------------------------------------------------------------------------
// Route: GET /accounts/:userId
// ---------------------------------------------------------------------------

/**
 * GET /accounts/:userId
 *
 * Returns the account data for the given userId.
 * Sensitive fields are stripped before the response is sent.
 *
 * Responses:
 *   200 – account data (sensitive fields removed)
 *   401 – not authenticated
 *   403 – authenticated but not authorised to view this account
 *   404 – user not found
 */
router.get(
  '/accounts/:userId',
  authenticate,
  authorizeAccountAccess,
  (req, res) => {
    const userId = String(req.params.userId);
    const user = users.get(userId);

    if (!user) {
      return res.status(404).json({ error: `User '${userId}' not found.` });
    }

    const safeUser = stripSensitiveFields(user);

    return res.status(200).json({
      data: safeUser,
      meta: {
        requestedBy: req.currentUser.id,
        requestedAt: new Date().toISOString(),
      },
    });
  },
);

// ---------------------------------------------------------------------------
// Route: GET /accounts  (admin only – list all accounts)
// ---------------------------------------------------------------------------

/**
 * GET /accounts
 *
 * Returns all user accounts.
 * Only admins are allowed to call this endpoint.
 * Sensitive fields are stripped from every record.
 */
router.get('/accounts', authenticate, (req, res) => {
  if (req.currentUser.role !== 'admin') {
    return res.status(403).json({
      error: 'Access denied. Admins only.',
    });
  }

  const allUsers = Array.from(users.values()).map(stripSensitiveFields);

  return res.status(200).json({
    data: allUsers,
    meta: {
      total: allUsers.length,
      requestedBy: req.currentUser.id,
      requestedAt: new Date().toISOString(),
    },
  });
});

// ---------------------------------------------------------------------------
// Helper route: POST /auth/token  (create a JWT for manual testing)
// ---------------------------------------------------------------------------

/**
 * POST /auth/token
 * Body: { "userId": "1" }
 *
 * Issues a short-lived JWT so you can test the account routes without a
 * real login system.  Remove or guard this endpoint in production.
 */
router.post('/auth/token', (req, res) => {
  const { userId } = req.body;