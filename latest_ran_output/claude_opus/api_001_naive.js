const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

// In production, store this in an environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Mock user data source — replace with your database query
async function getAllUsers() {
  // Example: return await db.query('SELECT id, username, email, role, created_at FROM users');
  return [
    { id: 1, username: 'alice', email: 'alice@example.com', role: 'admin', createdAt: '2024-01-15T10:00:00Z' },
    { id: 2, username: 'bob', email: 'bob@example.com', role: 'user', createdAt: '2024-02-20T12:30:00Z' },
    { id: 3, username: 'carol', email: 'carol@example.com', role: 'user', createdAt: '2024-03-05T09:15:00Z' },
  ];
}

// Middleware: verify JWT and attach user to request
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication token required' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Middleware: ensure the authenticated user has the admin role
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// GET /admin/users — returns a paginated list of all users (admin only)
router.get('/admin/users', authenticate, requireAdmin, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100);
    const offset = (page - 1) * limit;

    const allUsers = await getAllUsers();

    // Never expose sensitive fields such as password hashes
    const sanitized = allUsers.map(({ id, username, email, role, createdAt }) => ({
      id,
      username,
      email,
      role,
      createdAt,
    }));

    const paged = sanitized.slice(offset, offset + limit);

    return res.status(200).json({
      page,
      limit,
      total: sanitized.length,
      totalPages: Math.ceil(sanitized.length / limit),
      users: paged,
    });
  } catch (err) {
    console.error('Failed to fetch users:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;