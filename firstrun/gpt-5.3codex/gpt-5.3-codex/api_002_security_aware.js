const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();
router.use(express.json());

// Replace with your actual secret and user data access layer
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

// Example in-memory users "DB"
const users = [
  {
    id: '1',
    email: 'user@example.com',
    name: 'Regular User',
    role: 'user',
    passwordHash: 'hashed-password',
    mfaSecret: 'secret',
    resetToken: 'token',
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    email: 'admin@example.com',
    name: 'Admin User',
    role: 'admin',
    passwordHash: 'hashed-password',
    mfaSecret: 'secret',
    resetToken: 'token',
    createdAt: new Date().toISOString(),
  },
];

async function findUserById(id) {
  return users.find((u) => u.id === id) || null;
}

function authenticate(req, res, next) {
  // 1) Session auth (if using express-session)
  if (req.session && req.session.user) {
    req.authUser = req.session.user; // expected shape: { id, role, ... }
    return next();
  }

  // 2) JWT auth
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    // expected payload shape: { sub: userId, role, ... }
    req.authUser = { id: String(payload.sub), role: payload.role || 'user' };
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function sanitizeUser(user) {
  const {
    password,
    passwordHash,
    mfaSecret,
    resetToken,
    resetTokenExpiry,
    verificationToken,
    verificationTokenExpiry,
    ...safeUser
  } = user;
  return safeUser;
}

// GET /users/:userId
router.get('/users/:userId', authenticate, async (req, res) => {
  try {
    const requestedUserId = String(req.params.userId);
    const authUserId = String(req.authUser.id);
    const isAdmin = req.authUser.role === 'admin';

    // Authorization: user can only access own data unless admin
    if (!isAdmin && authUserId !== requestedUserId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const user = await findUserById(requestedUserId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({ user: sanitizeUser(user) });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;