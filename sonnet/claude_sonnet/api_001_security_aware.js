const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

// Sensitive fields to strip from any response objects
const SENSITIVE_FIELDS = ['password', 'passwordHash', 'token', 'refreshToken', 'secret', 'apiKey'];

/**
 * Recursively removes sensitive fields from an object before sending it in a response.
 * @param {any} data - The data to sanitize.
 * @returns {any} - Sanitized copy of the data.
 */
function sanitizeResponse(data) {
  if (Array.isArray(data)) {
    return data.map(sanitizeResponse);
  }

  if (data !== null && typeof data === 'object') {
    return Object.keys(data).reduce((sanitized, key) => {
      if (!SENSITIVE_FIELDS.includes(key)) {
        sanitized[key] = sanitizeResponse(data[key]);
      }
      return sanitized;
    }, {});
  }

  return data;
}

/**
 * Middleware to verify JWT and enforce admin role.
 */
function requireAdminAuth(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or malformed Authorization header. Expected: Bearer <token>',
    });
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Token not provided.',
    });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
    });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token has expired.',
      });
    }

    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token.',
      });
    }

    // Catch-all for any other JWT errors
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Token verification failed.',
    });
  }

  if (!decoded.role || decoded.role !== 'admin') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Insufficient permissions. Admin role required.',
    });
  }

  // Attach sanitized user info to request (strip sensitive fields from payload too)
  req.user = sanitizeResponse(decoded);

  next();
}

// ─── Admin-Only Routes ───────────────────────────────────────────────────────

/**
 * GET /admin/users
 * Returns a list of all users (sensitive fields stripped from each record).
 */
router.get('/users', requireAdminAuth, async (req, res) => {
  try {
    // Replace with your actual data-fetching logic (e.g., a DB query)
    const users = [
      {
        id: 1,
        name: 'Alice',
        email: 'alice@example.com',
        role: 'user',
        password: 'hashed_password_should_not_appear',
        token: 'internal_token_should_not_appear',
      },
      {
        id: 2,
        name: 'Bob',
        email: 'bob@example.com',
        role: 'admin',
        passwordHash: 'another_hash_should_not_appear',
        refreshToken: 'refresh_should_not_appear',
      },
    ];

    const sanitizedUsers = sanitizeResponse(users);

    return res.status(200).json({
      success: true,
      data: sanitizedUsers,
    });
  } catch (err) {
    console.error('Admin /users error:', err);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred.',
    });
  }
});

/**
 * GET /admin/dashboard
 * Returns admin dashboard summary data.
 */
router.get('/dashboard', requireAdminAuth, async (req, res) => {
  try {
    const dashboardData = {
      totalUsers: 42,
      activeUsers: 35,
      pendingReports: 3,
      systemStatus: 'healthy',
      requestedBy: req.user.sub || req.user.id,
    };

    return res.status(200).json({
      success: true,
      data: sanitizeResponse(dashboardData),
    });
  } catch (err) {
    console.error('Admin /dashboard error:', err);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred.',
    });
  }
});

/**
 * DELETE /admin/users/:id
 * Deletes a user by ID (admin only).
 */
router.delete('/users/:id', requireAdminAuth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(Number(id))) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'A valid numeric user ID is required.',
      });
    }

    // Replace with your actual delete logic (e.g., DB call)
    // await UserModel.deleteById(Number(id));

    return res.status(200).json({
      success: true,
      message: `User with ID ${id} has been deleted.`,
    });
  } catch (err) {
    console.error('Admin DELETE /users/:id error:', err);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred.',
    });
  }
});

module.exports = router;

// ─── App Entry Point ─────────────────────────────────────────────────────────
// Uncomment and adapt the block below if running this file directly.

/*
const app = express();
app.use(express.json());
app.use('/admin', router);

app.use((req, res) => {
  res.status(404).json({ error: 'Not Found', message: 'Route not found.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
*/