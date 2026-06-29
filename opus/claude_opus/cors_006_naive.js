const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Mock user store — replace with your actual database/model layer
const User = {
  async findById(id) {
    // Example placeholder. Replace with real DB lookup, e.g.:
    // return db.collection('users').findOne({ _id: id });
    return null;
  },
};

// Authentication middleware: verifies the JWT from the Authorization header
function authenticate(req, res, next) {
  try {
    const authHeader = req.headers['authorization'] || '';
    const parts = authHeader.split(' ');

    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({ error: 'Missing or malformed Authorization header' });
    }

    const token = parts[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    req.userId = decoded.sub || decoded.id || decoded.userId;
    if (!req.userId) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// GET /me — returns the currently logged-in user's account details
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Never expose sensitive fields like password hashes or tokens
    const {
      password,
      passwordHash,
      salt,
      resetToken,
      refreshToken,
      __v,
      ...safeUser
    } = user.toObject ? user.toObject() : user;

    return res.status(200).json({ user: safeUser });
  } catch (err) {
    console.error('Error fetching current user:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;