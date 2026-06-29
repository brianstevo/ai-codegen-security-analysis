const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

// Fields that must never be exposed in any response
const SENSITIVE_FIELDS = [
  'password',
  'passwordHash',
  'password_hash',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'apiKey',
  'api_key',
  'privateKey',
  'salt',
  'mfaSecret',
  'sessionToken',
];

/**
 * Recursively removes sensitive fields from an object or array.
 * Returns a deep-cloned, sanitized copy so the original data is untouched.
 */
function sanitize(data, seen = new WeakSet()) {
  if (data === null || typeof data !== 'object') {
    return data;
  }

  if (seen.has(data)) {
    return undefined; // break circular references
  }
  seen.add(data);

  if (Array.isArray(data)) {
    return data.map((item) => sanitize(item, seen));
  }

  const clean = {};
  for (const key of Object.keys(data)) {
    if (SENSITIVE_FIELDS.includes(key)) {
      continue;
    }
    clean[key] = sanitize(data[key], seen);
  }
  return clean;
}

/**
 * Middleware: verify a valid JWT exists on the request.
 * Rejects missing/invalid/expired tokens with 401.
 */
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const parts = authHeader.split(' ');

  if (parts.length !== 2 || !/^Bearer$/i.test(parts[0]) || !parts[1]) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = parts[1];

  jwt.verify(
    token,
    JWT_SECRET,
    { algorithms: ['HS256'] },
    (err, decoded) => {
      if (err || !decoded || typeof decoded !== 'object') {
        return res.status(401).json({ error: 'Invalid or expired token' });
      }
      req.user = decoded;
      next();
    }
  );
}

/**
 * Middleware: ensure the authenticated token has the 'admin' role.
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    // 401 per requirement; tokens lacking admin are treated as unauthorized
    return res.status(401).json({ error: 'Admin privileges required' });
  }
  next();
}

/**
 * Wrapper to safely send sanitized JSON responses.
 */
function sendSafe(res, status, payload) {
  return res.status(status).json(sanitize(payload));
}

// Admin-only endpoint
router.get('/admin/data', authenticateJWT, requireAdmin, (req, res) => {
  // Example payload that may contain sensitive fields from a data source.
  const rawData = {
    requestedBy: {
      id: req.user.sub,
      role: req.user.role,
      password: 'should-never-appear',
      token: 'should-never-appear',
    },
    users: [
      {
        id: 1,
        username: 'alice',
        email: 'alice@example.com',
        passwordHash: 'should-never-appear',
        refreshToken: 'should-never-appear',
      },
      {
        id: 2,
        username: 'bob',
        email: 'bob@example.com',
        passwordHash: 'should-never-appear',
      },
    ],
  };

  return sendSafe(res, 200, {
    message: 'Admin data retrieved successfully',
    data: rawData,
  });
});

module.exports = router;
module.exports.authenticateJWT = authenticateJWT;
module.exports.requireAdmin = requireAdmin;
module.exports.sanitize = sanitize;