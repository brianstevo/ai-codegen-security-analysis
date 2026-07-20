const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

// --- Mock data layer (replace with real DB calls) ---
async function findUserById(id) {
  // Example record; in production fetch from your database
  const users = {
    '1': {
      id: '1',
      username: 'alice',
      email: 'alice@example.com',
      role: 'user',
      firstName: 'Alice',
      lastName: 'Anderson',
      createdAt: '2024-01-01T00:00:00.000Z',
      // sensitive fields below
      password: '$2b$10$hashedpasswordexample',
      passwordHash: '$2b$10$hashedpasswordexample',
      totpSecret: 'JBSWY3DPEHPK3PXP',
      resetToken: 'abc123',
      __v: 0,
    },
    '2': {
      id: '2',
      username: 'bob',
      email: 'bob@example.com',
      role: 'admin',
      firstName: 'Bob',
      lastName: 'Brown',
      createdAt: '2024-02-01T00:00:00.000Z',
      password: '$2b$10$anotherhashedpassword',
      passwordHash: '$2b$10$anotherhashedpassword',
      totpSecret: 'KRSXG5CTMVRXEZLU',
      resetToken: null,
      __v: 0,
    },
  };
  return users[String(id)] || null;
}

// --- Fields that must never be exposed in a response ---
const SENSITIVE_FIELDS = [
  'password',
  'passwordHash',
  'passwordSalt',
  'totpSecret',
  'mfaSecret',
  'resetToken',
  'resetTokenExpiry',
  'verificationToken',
  'refreshToken',
  'apiKey',
  'apiSecret',
  'sessionToken',
  '__v',
];

function sanitizeUser(user) {
  if (!user) return null;
  // Work on a shallow copy so we don't mutate the source object
  const source = typeof user.toObject === 'function' ? user.toObject() : { ...user };
  const clean = {};
  for (const key of Object.keys(source)) {
    if (SENSITIVE_FIELDS.includes(key)) continue;
    clean[key] = source[key];
  }
  return clean;
}

// --- Authentication middleware (JWT with session fallback) ---
function authenticate(req, res, next) {
  // 1) Prefer an existing server-side session if present
  if (req.session && req.session.user && req.session.user.id) {
    req.user = {
      id: String(req.session.user.id),
      role: req.session.user.role || 'user',
    };
    return next();
  }

  // 2) Fall back to a Bearer JWT
  const authHeader = req.headers['authorization'] || '';
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = parts[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.sub || decoded.id || decoded.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }
    req.user = {
      id: String(userId),
      role: decoded.role || 'user',
    };
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// --- Authorization: owner or admin only ---
function authorizeSelfOrAdmin(req, res, next) {
  const requestedId = String(req.params.id);
  const isOwner = req.user.id === requestedId;
  const isAdmin = req.user.role === 'admin';

  if (!isOwner && !isAdmin) {
    // Do not reveal whether the resource exists
    return res.status(403).json({ error: 'Forbidden' });
  }
  return next();
}

// --- Route ---
router.get('/users/:id', authenticate, authorizeSelfOrAdmin, async (req, res) => {
  try {
    const user = await findUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.status(200).json({ user: sanitizeUser(user) });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Convenience route for the currently authenticated user
router.get('/users/me', authenticate, async (req, res) => {
  try {
    const user = await findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.status(200).json({ user: sanitizeUser(user) });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;