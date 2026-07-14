// userRoutes.js
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const router = express.Router();

// ----- Mongoose User Schema (adjust fields as needed) -----
const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email:    { type: String, required: true, unique: true },
  name:     { type: String },
  role:     { type: String, enum: ['user', 'admin'], default: 'user' },
  createdAt:{ type: Date, default: Date.now }
});
const User = mongoose.model('User', userSchema);

// ----- JWT Auth Middleware -----
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing or malformed token' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, role, ... }
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// ----- GET /users/:id -----
router.get('/users/:id', authMiddleware, async (req, res) => {
  const requestedId = req.params.id;

  // Only allow the user themselves or an admin to fetch the data
  if (req.user.id !== requestedId && req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }

  try {
    // Validate ObjectId format when using MongoDB
    if (!mongoose.Types.ObjectId.isValid(requestedId)) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }

    const user = await User.findById(requestedId).select('-__v -password'); // exclude sensitive fields
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ 
      id: user._id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt
    });
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;