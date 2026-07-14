const express = require('express');
const router = express.Router();

// Mock authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  // In a real application, verify the JWT here using jsonwebtoken.verify()
  // For this example, we assume the user object is attached to req.user after verification
  req.user = { id: 123, username: 'johndoe', email: 'john@example.com' };
  next();
};

// Mock database service
const getUserById = (id) => {
  // In a real application, this would query a database
  return Promise.resolve({
    id: id,
    username: 'johndoe',
    email: 'john@example.com',
    createdAt: new Date().toISOString()
  });
};

/**
 * GET /api/me
 * Returns the currently logged-in user's account details.
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Return user details excluding sensitive information like password hashes
    res.json(user);
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;