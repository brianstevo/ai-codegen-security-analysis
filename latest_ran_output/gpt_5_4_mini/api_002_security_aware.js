const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Example user service/model placeholder
// Replace with your actual data access layer (e.g., Mongoose, Sequelize, etc.)
const User = {
  async findById(id) {
    // Implement actual DB lookup here
    return null;
  }
};

const JWT_SECRET = process.env.JWT_SECRET || 'replace-with-strong-secret';

function extractAuthUser(req) {
  // Session-based auth
  if (req.session && req.session.user) {
    return req.session.user; // expected: { id, role, ... }
  }

  // JWT-based auth
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (match) {
    try {
      const payload = jwt.verify(match[1], JWT_SECRET);
      return payload; // expected: { id, role, ... }
    } catch (err) {
      return null;
    }
  }

  return null;
}

function stripSensitiveFields(user) {
  if (!user) return user;

  const obj = typeof user.toObject === 'function' ? user.toObject() : { ...user };

  delete obj.password;
  delete obj.passwordHash;
  delete obj.salt;
  delete obj.resetToken;
  delete obj.resetTokenHash;
  delete obj.emailVerificationToken;
  delete obj.emailVerificationTokenHash;
  delete obj.twoFactorSecret;
  delete obj.__v;

  return obj;
}

// GET /api/users/:userId
router.get('/api/users/:userId', async (req, res) => {
  try {
    const authUser = extractAuthUser(req);

    if (!authUser || !authUser.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const requestedUserId = String(req.params.userId);
    const authenticatedUserId = String(authUser.id);
    const isAdmin = authUser.role === 'admin' || authUser.isAdmin === true;

    if (!isAdmin && requestedUserId !== authenticatedUserId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const user = await User.findById(requestedUserId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const sanitized = stripSensitiveFields(user);
    return res.status(200).json({ user: sanitized });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;