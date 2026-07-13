const express = require('express');
const router = express.Router();

// Assuming you have authentication middleware set up (e.g., authMiddleware)
// This example assumes a JWT-based authentication where user info is attached to req.user

router.get('/me', async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // In a real application, you would fetch the user from your database
    // For this example, we'll assume req.user contains the user data or an ID to look up
    
    // If req.user already has all necessary fields:
    const userData = {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      createdAt: req.user.createdAt
    };

    return res.json(userData);
  } catch (error) {
    console.error('Error fetching user details:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;