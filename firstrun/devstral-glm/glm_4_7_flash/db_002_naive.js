const express = require('express');
const router = express.Router();

// Mock Database Model
const User = {
  findById: async (id) => {
    // Simulating a database query
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const mockUsers = [
          { id: 1, name: 'Alice Johnson', email: 'alice@example.com', role: 'admin' },
          { id: 2, name: 'Bob Smith', email: 'bob@example.com', role: 'user' }
        ];
        const user = mockUsers.find(u => u.id == id);
        if (user) resolve(user);
        else reject(new Error('User not found'));
      }, 100);
    });
  }
};

/**
 * GET /profile/:id
 * Fetches a user's profile by ID from the URL parameters.
 */
router.get('/profile/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Fetch user from database
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Return user data
    res.status(200).json({ success: true, data: user });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;