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
 * Recursively removes sensitive fields from an object before sending in a response.
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
 * Middleware: extract and verify JWT from Authorization header.
 * Attaches decoded payload to req.user on success.
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authorization header is missing',
    });
  }

  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authorization header must follow the format: Bearer <token>',
    });
  }

  const token = parts[1];

  if (!token) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Token is missing from Authorization header',
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
    });

    req.user = decoded;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token has expired',
      });
    }

    if (err instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token is invalid',
      });
    }

    // Unexpected error — do not leak details
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Token verification failed',
    });
  }
}

/**
 * Middleware: verify that the authenticated user has the 'admin' role.
 * Must be used after authenticateToken.
 */
function requireAdminRole(req, res, next) {
  if (!req.user || !req.user.role) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Token does not contain a role claim',
    });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Admin role is required to access this resource',
    });
  }

  next();
}

// Compose both middleware into a single reusable stack
const adminGuard = [authenticateToken, requireAdminRole];

// ---------------------------------------------------------------------------
// Admin-only routes
// ---------------------------------------------------------------------------

/**
 * GET /admin/dashboard
 * Returns a summary dashboard visible only to admins.
 */
router.get('/dashboard', adminGuard, (req, res) => {
  // Simulated dashboard data (replace with real DB queries)
  const dashboardData = {
    totalUsers: 1024,
    activeUsers: 312,
    pendingReports: 5,
    requestedBy: {
      id: req.user.sub,
      username: req.user.username,
      role: req.user.role,
      // Deliberately include a sensitive field to demonstrate sanitization
      password: 'should-never-appear',
      token: 'should-never-appear',
    },
  };

  return res.status(200).json(sanitizeResponse(dashboardData));
});

/**
 * GET /admin/users
 * Returns a list of all users (sensitive fields stripped).
 */
router.get('/users', adminGuard, (req, res) => {
  // Simulated user records (replace with real DB queries)
  const users = [
    { id: 1, username: 'alice', email: 'alice@example.com', role: 'user', password: 'hashed_secret_1' },
    { id: 2, username: 'bob', email: 'bob@example.com', role: 'admin', passwordHash: 'hashed_secret_2' },
    { id: 3, username: 'carol', email: 'carol@example.com', role: 'user', refreshToken: 'some_refresh_token' },
  ];

  return res.status(200).json(sanitizeResponse(users));
});

/**
 * DELETE /admin/users/:id
 * Deletes a user by ID (admin only).
 */
router.delete('/users/:id', adminGuard, (req, res) => {
  const { id } = req.params;

  // Basic validation
  if (!id || isNaN(Number(id))) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'A valid numeric user ID is required',
    });
  }

  // Simulate deletion (replace with real DB logic)
  return res.status(200).json(
    sanitizeResponse({
      message: `User ${id} has been deleted`,
      deletedBy: {
        id: req.user.sub,
        username: req.user.username,
        token: 'should-never-appear',
      },
    })
  );
});

module.exports = router;

// ---------------------------------------------------------------------------
// App bootstrap (for standalone testing)
// ---------------------------------------------------------------------------

if (require.main === module) {
  const app = express();

  app.use(express.json());
  app.use('/admin', router);

  // Global error handler — never leaks stack traces or sensitive info
  app.use((err, req, res, _next) => {
    console.error('Unhandled error:', err.message);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred',
    });
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Admin API listening on port ${PORT}`);
  });
}