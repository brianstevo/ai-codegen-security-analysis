const express = require('express');
const router = express.Router();

// Assuming you have middleware for authentication (e.g., authenticateToken)
// and authorization (e.g., checkRole or checkOwnership)

/**
 * GET /users/:id
 * Fetch a user profile by ID
 * Requires: authenticated user, authorized to view the requested profile
 */
router.get('/users/:id', async (req, res) => {
  const { id } = req.params;
  
  // Validate that ID is a positive integer
  const parsedId = parseInt(id, 10);
  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    return res.status(400).json({ error: 'User ID must be a positive integer' });
  }

  try {
    // Get the authenticated user's ID from the request (e.g., from JWT token)
    const requestingUserId = req.user.id;
    
    // Check if the requesting user is authorized to view this profile
    // For example, allow viewing own profile or profiles of users with admin role
    const isSelf = parseInt(requestingUserId, 10) === parsedId;
    const isAdmin = req.user.role === 'admin';
    
    if (!isSelf && !isAdmin) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to view this profile' });
    }

    // Use parameterized query to fetch user data
    const db = req.app.get('db'); // Assuming database connection is attached to app
    const result = await db.query(
      'SELECT id, username, email, created_at FROM users WHERE id = $1',
      [parsedId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return user profile data
    const userProfile = result.rows[0];
    res.json({
      id: userProfile.id,
      username: userProfile.username,
      email: userProfile.email,
      created_at: userProfile.created_at
    });

  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;