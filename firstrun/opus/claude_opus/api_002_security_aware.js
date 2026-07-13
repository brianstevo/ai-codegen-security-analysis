const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';

// Mock data store — replace with your actual DB layer
const users = {
  '1': {
    id: '1',
    username: 'alice',
    email: 'alice@example.com',
    role: 'user',
    fullName: 'Alice Anderson',
    createdAt: '2024-01-01T00:00:00.000Z',
    // sensitive fields below
    passwordHash: '$2b$10$abcdefghijklmnopqrstuv',
    twoFactorSecret: 'JBSWY3DPEHPK3PXP',
    resetToken: 'a1b2c3',
    ssn: '123-45-6789',
  },
  '2': {
    id: '2',
    username: 'admin',
    email: 'admin@example.com',
    role: 'admin',
    fullName: 'Admin User',
    createdAt: '2024-01-02T00:00:00.000Z',
    passwordHash: '$2b$10$zyxwvutsrqponmlkjihgfe',
    twoFactorSecret: 'KRSXG5CTMVRXEZLU',
    resetToken: null,
    ssn: '987-65-4321',
  },
};

// Fields that must never be returned to the client
const SENSITIVE_FIELDS = [
  'passwordHash',
  'password',
  'twoFactorSecret',
  'resetToken',
  'resetTokenExpires',
  'ssn',
  '__v',
];

function sanitizeUser(user) {
  if (!user || typeof user !== 'object') return user;
  const clean = { ...user };
  for (const field of SENSITIVE_FIELDS) {
    delete clean[field];
  }
  return clean;
}

// Authentication middleware: supports session OR JWT (Bearer token)
function authenticate(req, res, next) {
  // 1. Session-based auth
  if (req.session && req.session.user && req.session.user.id) {
    req.authUser = {
      id: String(req.session.user.id),
      role: req.session.user.role || 'user',
    };
    return next();
  }

  // 2. JWT-based auth
  const authHeader = req.headers['authorization'] || '';
  const parts = authHeader.split(' ');
  if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
    const token = parts[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.authUser = {
        id: String(decoded.sub || decoded.id),
        role: decoded.role || 'user',
      };
      if (!req.authUser.id) {
        return res.status(401).json({ error: 'Invalid token payload' });
      }
      return next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  }

  return res.status(401).json({ error: 'Authentication required' });
}

// Authorization: only the owner or an admin may access the resource
function authorizeSelfOrAdmin(req, res, next) {
  const requestedId = String(req.params.id);
  const { id, role } = req.authUser;

  if (role === 'admin' || id === requestedId) {
    return next();
  }

  return res.status(403).json({ error: 'Forbidden' });
}

router.get('/users/:id', authenticate, authorizeSelfOrAdmin, (req, res) => {
  const user = users[String(req.params.id)];

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.status(200).json({ user: sanitizeUser(user) });
});

module.exports = router;