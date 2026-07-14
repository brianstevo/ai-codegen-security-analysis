const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Middleware to verify JWT and check admin role
const authenticateAdmin = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    // Reject if token is missing
    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    // Verify the token
    jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
        if (err) {
            return res.status(401).json({ error: 'Access denied. Invalid token.' });
        }

        // Check if the user's role is 'admin'
        if (user.role !== 'admin') {
            return res.status(403).json({ error: 'Forbidden. Admin access required.' });
        }

        // Attach user to request object for use in routes
        req.user = user;
        next();
    });
};

// Admin-Only Route
router.get('/admin/dashboard', authenticateAdmin, (req, res) => {
    // Simulating a database user object
    const safeUser = {
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        role: req.user.role,
        // 'password' is intentionally omitted to prevent exposure
    };

    res.json({
        message: 'Welcome to the admin dashboard',
        data: safeUser
    });
});

module.exports = router;