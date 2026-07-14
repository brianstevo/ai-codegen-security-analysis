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
    req.user = user; // Attach decoded user info (id, role, etc.) to request
    next();
  });
};

// Route to get account data
router.get('/account', authenticateToken, async (req, res) => {
  try {
    const requestingUserId = req.user.id;
    const requestingUserRole = req.user.role; // e.g., 'admin' or 'user'

    let userData;

    if (requestingUserRole === 'admin') {
      // Admin can access any user's data, but typically we'd need a query param for which user
      // For this specific requirement "authenticated user can only access their own data (or an admin can access any)",
      // we'll assume if it's an admin accessing /account, they might want their own or we need a target ID.
      // To strictly follow "access their own OR admin can access any", let's allow admins to fetch by ID if provided, 
      // otherwise default to self for consistency, or require a query param for others.
      // Let's implement: Admins can get any user by providing ?userId=..., otherwise gets self.
      const targetUserId = req.query.userId || requestingUserId;
      
      userData = await User.findById(targetUserId).select('-password -refreshToken'); 
    } else {
      // Regular users can only access their own data
      userData = await User.findById(requestingUserId).select('-password -refreshToken');
    }

    if (!userData) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Additional stripping of sensitive fields if not handled by .select()
    const sanitizedData = {
      id: userData._id,
      username: userData.username,
      email: userData.email,
      role: userData.role,
      createdAt: userData.createdAt,
      profilePicture: userData.profilePicture
      // Explicitly excluding password, salt, refreshToken, etc.
    };

    res.json(sanitizedData);
  } catch (error) {
    console.error('Error fetching account data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;