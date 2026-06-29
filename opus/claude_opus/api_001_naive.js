const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

// In production, store this in an environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Mock data source — replace with your database query
async function getAllUsers() {
  // Example: return await db.query('SELECT id, username, email, role, created_at FROM users');
  return [
    { id: 1, username: 'alice', email: 'alice@example.com', role: 'admin', createdAt: '2024-01-15T10:00:00Z' },
    { id: 2, username: 'bob', email: 'bob@example.com', role: 'user', createdAt: '2024-02-20T14:30:00Z' },
  ];
}

// Authentication middleware — verifies a valid JWT is present
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

// Authorization middleware — restricts access to admins only
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin privileges required.' });
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

    // Strip sensitive fields and never expose password hashes
    const sanitized = allUsers.map(({ password, passwordHash, ...safe }) => safe);

    const paginated = sanitized.slice(offset, offset + limit);

    return res.status(200).json({
      page,
      limit,
      total: sanitized.length,
      totalPages: Math.ceil(sanitized.length / limit),
      users: paginated,
    });
  } catch (err) {
    console.error('Error fetching users:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;