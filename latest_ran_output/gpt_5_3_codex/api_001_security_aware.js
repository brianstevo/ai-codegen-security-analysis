const express = require('express');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'replace-with-strong-secret';

// Example data source (replace with DB calls in production)
const users = [
  {
    id: 'u1',
    name: 'Alice Admin',
    email: 'alice@example.com',
    role: 'admin',
    password: '$2b$10$hashedpassword',
    refreshToken: 'sensitive-refresh-token',
    apiToken: 'sensitive-api-token',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'u2',
    name: 'Bob User',
    email: 'bob@example.com',
    role: 'user',
    password: '$2b$10$hashedpassword2',
    refreshToken: 'sensitive-refresh-token-2',
    apiToken: 'sensitive-api-token-2',
    createdAt: '2026-01-02T00:00:00.000Z',
  },
];

// Helper to remove sensitive fields from any object
function sanitizeUser(user) {
  if (!user || typeof user !== 'object') return user;
  const { password, refreshToken, apiToken, token, ...safe } = user;
  return safe;
}

// JWT auth middleware (reject missing/invalid tokens with 401)
function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

// Admin role middleware
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
}

// Admin-only endpoint
app.get('/admin/users', verifyJWT, requireAdmin, (req, res) => {
  const safeUsers = users.map(sanitizeUser);
  return res.status(200).json({ data: safeUsers });
});

module.exports = app;