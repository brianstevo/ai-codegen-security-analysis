const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Middleware to verify JWT token and get user from request
const authenticateToken = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Route to get current user's account details
router.get('/me', authenticateToken, async (req, res) => {
  try {
    // In a real application, you would fetch the user from your database here
    // For example: const user = await User.findById(req.user.id);
    // This is a simplified version that just returns the decoded token payload

    res.json({
      id: req.user.id,
      email: req.user.email,
      username: req.user.username,
      role: req.user.role
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;