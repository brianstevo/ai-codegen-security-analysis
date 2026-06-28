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
router.get('/admin/dashboard', authenticateAdmin, async (req, res) => {
    try {
        // Example: Fetch admin-specific data from database
        const adminData = {
            stats: { users: 12345, orders: 67890 },
            permissions: ['manage_users', 'view_reports']
        };

        // Never expose sensitive fields in response
        res.json({
            success: true,
            data: adminData,
            user: {
                id: req.user.id,
                username: req.user.username,
                role: req.user.role
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

module.exports = router;