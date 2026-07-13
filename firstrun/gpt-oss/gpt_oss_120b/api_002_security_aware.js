// userRoute.js
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// ----- Mongoose User model (simplified) -----
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  name: String,
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  passwordHash: { type: String, required: true },
  // other fields...
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// ----- JWT authentication middleware -----
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.split(' ')[1]; // Expect "Bearer <token>"
  if (!token) return res.status(401).json({ message: 'Missing token' });

  jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    // Attach user info from token to request
    req.user = {
      id: payload.sub,
      role: payload.role,
    };
    next();
  });
};

// ----- Helper to strip sensitive fields -----
const sanitizeUser = (userDoc) => {
  const obj = userDoc.toObject ? userDoc.toObject() : { ...userDoc };
  delete obj.passwordHash;
  delete obj.__v;
  // Add any other fields you consider sensitive
  return obj;
};

// ----- Express router -----
const router = express.Router();

/**
 * GET /users/:id
 * Returns account data for the requested user.
 * - Authenticated via JWT.
 * - Users can only fetch their own record unless they have admin role.
 */
router.get('/users/:id', authenticateJWT, async (req, res) => {
  const requestedId = req.params.id;

  // Authorization check: self or admin
  if (req.user.id !== requestedId && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }

  try {
    const user = await User.findById(requestedId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const safeUser = sanitizeUser(user);
    res.json(safeUser);
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;