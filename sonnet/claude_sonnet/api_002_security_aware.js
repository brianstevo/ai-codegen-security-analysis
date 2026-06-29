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
  'bankAccount',
];

// ---------------------------------------------------------------------------
// Mock database helpers  (replace with your real DB layer)
// ---------------------------------------------------------------------------
const users = new Map([
  [
    '1',
    {
      id: '1',
      username: 'alice',
      email: 'alice@example.com',
      passwordHash: '$2b$10$hashedpassword',
      role: 'user',
      firstName: 'Alice',
      lastName: 'Smith',
      phone: '+1-555-0100',
      resetToken: 'super-secret-reset-token',
      twoFactorSecret: 'JBSWY3DPEHPK3PXP',
      createdAt: new Date('2023-01-15'),
      updatedAt: new Date('2024-06-01'),
    },
  ],
  [
    '2',
    {
      id: '2',
      username: 'bob',
      email: 'bob@example.com',
      passwordHash: '$2b$10$anotherhashedpassword',
      role: 'user',
      firstName: 'Bob',
      lastName: 'Jones',
      phone: '+1-555-0200',
      resetToken: null,
      twoFactorSecret: null,
      createdAt: new Date('2023-03-22'),
      updatedAt: new Date('2024-05-10'),
    },
  ],
  [
    '99',
    {
      id: '99',
      username: 'admin',
      email: 'admin@example.com',
      passwordHash: '$2b$10$adminhashedpassword',
      role: 'admin',
      firstName: 'Super',
      lastName: 'Admin',
      phone: '+1-555-9999',
      resetToken: null,
      twoFactorSecret: 'ADMINTWOFACTORSECRET',
      createdAt: new Date('2022-01-01'),
      updatedAt: new Date('2024-07-01'),
    },
  ],
]);

async function findUserById(id) {
  return users.get(String(id)) || null;
}

// ---------------------------------------------------------------------------
// Utility: strip sensitive fields from a user object
// ---------------------------------------------------------------------------
function sanitizeUser(user) {
  const sanitized = { ...user };
  for (const field of SENSITIVE_FIELDS) {
    delete sanitized[field];
  }
  return sanitized;
}

// ---------------------------------------------------------------------------
// Middleware: authenticate via JWT (Bearer token) OR session
// ---------------------------------------------------------------------------
function authenticate(req, res, next) {
  // 1. Try session-based auth first
  if (req.session && req.session.userId) {
    req.authUserId = String(req.session.userId);
    req.authRole = req.session.role || 'user';
    return next();
  }

  // 2. Fall back to JWT Bearer token
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required. Provide a Bearer token or a valid session.',
    });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Malformed Authorization header. Expected: Bearer <token>',
    });
  }

  const token = parts[1];

  try {
    const payload = jwt.verify(token, JWT_SECRET);

    if (!payload.sub) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token payload is missing the subject (sub) claim.',
      });
    }

    req.authUserId = String(payload.sub);
    req.authRole = payload.role || 'user';
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token has expired. Please log in again.',
      });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token signature.',
      });
    }
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Token verification failed.',
    });
  }
}

// ---------------------------------------------------------------------------
// Middleware: authorize — owns the resource OR is an admin
// ---------------------------------------------------------------------------
function authorizeAccountAccess(req, res, next) {
  const requestedId = String(req.params.userId);
  const isOwner = req.authUserId === requestedId;
  const isAdmin = req.authRole === 'admin';

  if (!isOwner && !isAdmin) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'You do not have permission to access this account.',
    });
  }

  next();
}

// ---------------------------------------------------------------------------
// Route: GET /api/accounts/:userId
// ---------------------------------------------------------------------------
router.get(
  '/api/accounts/:userId',
  authenticate,
  authorizeAccountAccess,
  async (req, res) => {
    try {
      const { userId } = req.params;

      // Validate param format (simple numeric check; adapt to UUID etc. as needed)
      if (!/^\d+$/.test(userId)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'userId must be a numeric string.',
        });
      }

      const user = await findUserById(userId);

      if (!user) {
        return res.status(404).json({
          error: 'Not Found',
          message: `No account found with id ${userId}.`,
        });
      }

      const safeUser = sanitizeUser(user);

      return res.status(200).json({
        data: safeUser,
      });
    } catch (err) {
      console.error('Error fetching account:', err);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred. Please try again later.',
      });
    }
  }
);

// ---------------------------------------------------------------------------
// Route: GET /api/accounts  (admin only — list all accounts)
// ---------------------------------------------------------------------------
router.get('/api/accounts', authenticate, (req, res) => {
  if (req.authRole !== 'admin') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Only administrators may list all accounts.',
    });
  }

  const allUsers = Array.from(users.values()).map(sanitizeUser);

  return res.status(200).json({
    data: allUsers,
    total: allUsers.length,
  });
});

// ---------------------------------------------------------------------------
// Demo login route — issues a JWT so the above routes can be tested easily
// ---------------------------------------------------------------------------
router.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  // Find user by username (intentionally simplified — use bcrypt.compare in production)
  const user = Array.from(users.values()).find((u) => u.username === username);

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  // ⚠️  In production replace this with:  bcrypt.compare(password, user.passwordHash)
  if (password !== 'demo-password') {
    return res.status(401).json({