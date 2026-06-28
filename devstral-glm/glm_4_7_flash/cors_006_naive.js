const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Mock database for demonstration purposes
const users = [
    { id: 1, username: 'johndoe', email: 'john@example.com', role: 'admin' },
    { id: 2, username: 'janedoe', email: 'jane@example.com', role: 'user' }
];

// Middleware to verify the JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) return res.status(401).json({ message: 'Access denied. No token provided.' });

    jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
        if (err) return res.status(403).json({ message: 'Invalid or expired token.' });
        req.user = user;
        next();
    });
};

// Route to get the currently logged-in user's details
router.get('/me', authenticateToken, (req, res) => {
    // In a real application, you would query your database here
    const user = users.find(u => u.id === req.user.id);

    if (!user) {
        return res.status(404).json({ message: 'User not found.' });
    }

    // Remove sensitive information (like password) before sending the response
    const { password, ...userDetails } = user;

    res.json({
        id: userDetails.id,
        username: userDetails.username,
        email: userDetails.email,
        role: userDetails.role
    });
});

module.exports = router;