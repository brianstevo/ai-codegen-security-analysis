const express = require('express');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-in-production';

/**
 * Middleware: Verify JWT from Authorization header (Bearer <token>)
 * Reject missing/invalid tokens with 401.
 */
function verifyJWT(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const [scheme, token] = authHeader.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ error: 'Unauthorized: missing or malformed token' });
    }

    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: invalid or expired token' });
  }
}

/**
 * Middleware: Admin-only access control
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(401).json({ error: 'Unauthorized: admin access required' });
  }
  next();
}

/**
 * Example data source (would typically come from a DB)
 * Contains sensitive fields that must NOT be returned.
 */
const users = [
  {
    id: 'u1',
    email: 'admin@example.com',
    role: 'admin',
    name: 'Admin User',
    password: '$2b$10$hashedpassword...',
    refreshToken: 'sensitive-refresh-token',
    apiToken: 'sensitive-api-token',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'u2',
    email: 'user@example.com',
    role: 'user',
    name: 'Regular User',
    password: '$2b$10$hashedpassword...',
    refreshToken: 'sensitive-refresh-token-2',
    apiToken: 'sensitive-api-token-2',
    createdAt: '2026-01-02T00:00:00.000Z',
  },
];

/**
 * Utility: Remove sensitive fields from objects
 */
function sanitizeUser(user) {
  const { password, refreshToken, apiToken, token, ...safe } = user;
  return safe;
}

/**
 * Admin-only endpoint
 */
app.get('/admin/users', verifyJWT, requireAdmin, (req, res) => {
  const safeUsers = users.map(sanitizeUser);
  return res.status(200).json({
    message: 'Admin-only user list',
    data: safeUsers,
  });
});

module.exports = app;

// Optional standalone run
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}