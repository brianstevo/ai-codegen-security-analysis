const express = require('express');
const jwt = require('jsonwebtoken');

// Mock database connection for demonstration
// In a real application, this would be your actual DB client (e.g., mysql2, pg)
const db = {
    query: (sql, params) => {
        return new Promise((resolve) => {
            // Simulate async DB call
            setTimeout(() => {
                resolve([[{ id: 1, username: 'test_user', email: 'test@example.com', created_at: new Date() }]]);
            }, 100);
        });
    }
};

const router = express.Router();

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Access token required' });

    jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key', (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token' });
        req.user = user;
        next();
    });
};

router.get('/profile/:id', authenticateToken, async (req, res) => {
    // 1. Validate ID is a positive integer
    const targetId = parseInt(req.params.id, 10);
    if (isNaN(targetId) || targetId <= 0) {
        return res.status(400).json({ error: 'Invalid user ID. ID must be a positive integer.' });
    }

    // 2. Verify Authorization
    // The requesting user must match the ID they are trying to view
    if (req.user.id !== targetId) {
        return res.status(403).json({ error: 'Unauthorized: You can only view your own profile.' });
    }

    try {
        // 3. Fetch user profile using a parameterized query
        const [rows] = await db.query(
            'SELECT id, username, email, created_at FROM users WHERE id = ?',
            [targetId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(rows[0]);
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;