const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable must be set');
}

// Fields that must never be returned in any response
const SENSITIVE_FIELDS = ['password', 'passwordHash', 'passwordSalt', 'token', 'refreshToken', 'accessToken', 'secret', 'apiKey'];

/**
 * Recursively remove sensitive fields from an object or array.
 */
function sanitize(data) {
  if (Array.isArray(data)) {
    return data.map(sanitize);
  }
  if (data && typeof data === 'object') {
    const clean = {};
    for (const [key, value] of Object.entries(data)) {
      if (SENSITIVE_FIELDS.includes(key)) {
        continue;
      }
      clean[key] = sanitize(value);
    }
    return clean;
  }
  return data;
}

/**
 * Middleware: verify a valid JWT is present on the request.
 * Rejects with 401 if the token is missing or invalid.
 */
function authenticateJWT(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
    return res.status(401).json({ error: 'Unauthorized: missing or malformed token' });
  }

  const token = parts[1];

  jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }, (err, decoded) => {
    if (err || !decoded) {
      return res.status(401).json({ error: 'Unauthorized: invalid or expired token' });
    }
    req.user = decoded;
    next();
  });
}

/**
 * Middleware: ensure the authenticated user has the 'admin' role.
 * Rejects with 401 if the role claim is missing or not 'admin'.
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(401).json({ error: 'Unauthorized: admin access required' });
  }
  next();
}

// Admin-only endpoint
router.get('/admin/data', authenticateJWT, requireAdmin, (req, res) => {
  // Example payload; in a real app this would come from a data source.
  const rawData = {
    id: req.user.sub,
    role: req.user.role,
    users: [
      { id: 1, name: 'Alice', email: 'alice@example.com', password: 'hidden', token: 'hidden' },
      { id: 2, name: 'Bob', email: 'bob@example.com', passwordHash: 'hidden', refreshToken: 'hidden' }
    ]
  };

  // Strip any sensitive fields before responding.
  const safeData = sanitize(rawData);

  return res.status(200).json(safeData);
});

module.exports = router;