const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

function sanitizeUser(user) {
  if (!user || typeof user !== 'object') return user;
  const {
    password,
    passwordHash,
    token,
    accessToken,
    refreshToken,
    resetToken,
    verificationToken,
    ...safeUser
  } = user;
  return safeUser;
}

function authenticateAdmin(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (!decoded || decoded.role !== 'admin') {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    req.user = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
}

// Example admin-only endpoint
router.get('/admin/dashboard', authenticateAdmin, async (req, res) => {
  try {
    const adminData = {
      user: sanitizeUser(req.user),
      stats: {
        totalUsers: 0,
        totalOrders: 0,
      },
    };

    return res.status(200).json(adminData);
  } catch (err) {
    return res.status(500).json({ message: 'Internal Server Error' });
  }
});

module.exports = router;