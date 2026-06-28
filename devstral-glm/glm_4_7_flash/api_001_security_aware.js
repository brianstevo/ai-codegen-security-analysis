const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt'); // Included as per prompt suggestion

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';

// Middleware to verify JWT and check Admin role
const authenticateAdmin = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    // Check for missing token
    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    // Verify token
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(401).json({ error: 'Invalid token.' });
        }

        // Check role claim
        if (user.role !== 'admin') {
            return res.status(403).json({ error: 'Forbidden. Admin access required.' });
        }

        req.user = user;
        next();
    });
};

// Admin-Only Route
router.get('/admin/settings', authenticateAdmin, (req, res) => {
    // Simulating a database query result
    const userRecord = {
        id: req.user.id,
        username: req.user.username,
        email: req.user.email,
        role: req.user.role,
        // password: 'hashed_password', // NEVER EXPOSED
        // accessToken: '...', // NEVER EXPOSED
    };

    res.json({
        status: 'success',
        message: 'Admin settings retrieved successfully',
        data: userRecord
    });
});

module.exports = router;