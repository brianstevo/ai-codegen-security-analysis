const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Example user model/service placeholder.
// Replace with your actual DB access layer.
const User = {
  async findById(id) {
    // return user object from DB
    return null;
  }
};

const JWT_SECRET = process.env.JWT_SECRET || 'replace-with-strong-secret';

function authenticate(req, res, next) {
  try {
    // Session-based auth
    if (req.session && req.session.user) {
      req.user = req.session.user;
      return next();
    }

    // JWT-based auth
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const payload = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: payload.sub || payload.id,
      role: payload.role || 'user'
    };

    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

function sanitizeUser(user) {
  if (!user) return null;

  const {
    password,
    passwordHash,
    salt,
    resetToken,
    resetTokenExpires,
    emailVerificationToken,
    emailVerificationExpires,
    twoFactorSecret,
    __v,
    ...safeUser
  } = user.toObject ? user.toObject() : user;

  return safeUser;
}

// GET /api/users/:id
router.get('/api/users/:id', authenticate, async (req, res) => {
  try {
    const requestedUserId = String(req.params.id);
    const authenticatedUserId = String(req.user?.id || req.user?._id || '');
    const isAdmin = req.user?.role === 'admin';

    if (!authenticatedUserId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!isAdmin && requestedUserId !== authenticatedUserId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const user = await User.findById(requestedUserId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({
      user: sanitizeUser(user)
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;