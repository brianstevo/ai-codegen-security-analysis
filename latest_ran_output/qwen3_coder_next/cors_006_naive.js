const express = require('express');
const router = express.Router();

// Assuming you have middleware like 'auth' that attaches the user object to req.user
// Example: const auth = require('../middleware/auth');

/**
 * GET /api/users/me
 * Returns the currently logged-in user's account details
 */
router.get('/me', (req, res) => {
  // Check if user is authenticated (assuming authentication middleware sets req.user)
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Return user details excluding sensitive information like password
  const { password, ...userDetails } = req.user.toObject ? req.user.toObject() : req.user;
  
  res.json(userDetails);
});

module.exports = router;