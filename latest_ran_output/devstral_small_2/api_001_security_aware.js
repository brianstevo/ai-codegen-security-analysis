const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Middleware to verify JWT and admin role
const authenticateAdmin = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(401);
        if (user.role !== 'admin') return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Admin-only endpoint
router.get('/admin/dashboard', authenticateAdmin, (req, res) => {
    // Example response - never expose sensitive fields
    const sanitizedResponse = {
        message: 'Welcome to the admin dashboard',
        stats: {
            totalUsers: 100,
            activeProjects: 5
        }
    };
    res.json(sanitizedResponse);
});

module.exports = router;