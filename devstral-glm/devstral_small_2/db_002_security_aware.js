const express = require('express');
const router = express.Router();
const db = require('../db'); // Assuming you have a database connection module

// Middleware to check if user is authenticated (you should implement this)
const authenticateUser = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

// Route to get user profile by ID
router.get('/users/:id', authenticateUser, async (req, res) => {
    const { id } = req.params;

    // Validate that the ID is a positive integer
    if (!/^\d+$/.test(id)) {
        return res.status(400).json({ error: 'Invalid user ID' });
    }

    try {
        const userId = parseInt(id, 10);

        // Check if the requesting user is authorized to view this profile
        // (e.g., the user is viewing their own profile or has admin privileges)
        const isAuthorized = req.user.id === userId || req.user.role === 'admin';

        if (!isAuthorized) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        // Fetch the user profile using a parameterized query
        const [user] = await db.query(
            'SELECT id, username, email, created_at FROM users WHERE id = ?',
            [userId]
        );

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Return the user profile
        res.json(user);
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;