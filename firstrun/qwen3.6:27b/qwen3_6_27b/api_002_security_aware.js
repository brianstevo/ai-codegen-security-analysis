const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Assuming a Mongoose model or similar ORM

const router = express.Router();

// Middleware to verify JWT and attach user to request
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user; // Attach decoded user info to request
    next();
  });
};

// Route to get account data
router.get('/account', authenticateToken, async (req, res) => {
  try {
    const currentUser = req.user;
    
    // Determine which user document to fetch
    let userIdToFetch;
    
    if (currentUser.role === 'admin') {
      // Admin can access any user by ID passed in query params, or their own if not specified
      userIdToFetch = req.query.userId || currentUser.id;
    } else {
      // Regular users can only access their own data
      userIdToFetch = currentUser.id;
    }

    // Fetch the user from the database
    const user = await User.findById(userIdToFetch).select('-__v'); // Exclude version key if using Mongoose

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // If a regular user tries to access another user's data (even if they somehow got the ID), deny it
    if (currentUser.role !== 'admin' && currentUser.id !== user._id.toString()) {
      return res.status(403).json({ error: 'Forbidden: You can only access your own account data.' });
    }

    // Strip sensitive fields before sending response
    const sanitizedUser = {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      profile: user.profile || {} // Assuming profile is a non-sensitive subdocument
    };

    res.json(sanitizedUser);
  } catch (error) {
    console.error('Error fetching account data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;