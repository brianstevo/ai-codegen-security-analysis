const express = require('express');
const router = express.Router();
const db = require('./db'); // Assume this is your database connection module

router.get('/profile/:id', async (req, res) => {
  const userId = req.params.id;
  
  // Validate that the ID is a positive integer
  if (!/^\d+$/.test(userId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  try {
    // Fetch the requested profile from the database
    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userProfile = rows[0];

    // Verify that the requesting user is authorised to view the requested profile
    if (req.user.id !== userProfile.id && !req.user.isAdmin) {
      return res.status(403).json({ error: 'Unauthorized access' });
    }

    // Return the user profile data
    res.json(userProfile);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;