const express = require('express');
const router = express.Router();

// Assuming you have middleware for authentication (e.g., authenticateToken)
// and authorization (e.g., authorizeRole or similar)

// Example database query function - replace with your actual DB implementation
async function getUserById(id) {
  // Using a parameterized query to prevent SQL injection
  const db = require('../db'); // Replace with your DB module
  const result = await db.query('SELECT id, username, email, created_at FROM users WHERE id = $1', [id]);
  return result.rows[0];
}

// Route to fetch user profile by ID
router.get('/users/:id', async (req, res) => {
  try {
    // Validate that :id is a positive integer
    const userId = parseInt(req.params.id, 10);
    
    if (isNaN(userId) || userId <= 0 || !Number.isInteger(userId)) {
      return res.status(400).json({ error: 'Invalid user ID. Must be a positive integer.' });
    }

    // Verify authentication
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Authorization check: user can view their own profile OR admin can view any profile
    const requestingUserId = req.user.id;
    const isSelf = requestingUserId === userId;
    const isAdmin = req.user.role === 'admin';

    if (!isSelf && !isAdmin) {
      return res.status(403).json({ error: 'Not authorized to view this profile' });
    }

    // Fetch user data
    const user = await getUserById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return user profile (excluding sensitive fields like password)
    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      created_at: user.created_at
    });

  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;