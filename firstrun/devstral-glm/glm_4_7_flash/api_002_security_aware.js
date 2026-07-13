const express = require('express');
const jwt = require('jsonwebtoken');

const app = express();

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format: "Bearer <token>"

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// Mock Database
const users = [
    { id: 1, name: 'Alice Johnson', email: 'alice@example.com', role: 'user', password: 'hashed_password_123' },
    { id: 2, name: 'Bob Smith', email: 'bob@example.com', role: 'admin', password: 'hashed_password_456' }
];

/**
 * Route: GET /api/users/:id
 * Returns user account data.
 * - Requires JWT authentication.
 * - Enforces ownership (user can only see their own data) or Admin access (can see any).
 * - Strips sensitive fields (password) before sending.
 */
app.get('/api/users/:id', authenticateToken, (req, res) => {
    const targetId = parseInt(req.params.id);
    const currentUserId = req.user.id;
    const currentUserRole = req.user.role;

    // Authorization Logic
    const isSelf = targetId === currentUserId;
    const isAdmin = currentUserRole === 'admin';

    if (!isSelf && !isAdmin) {
        return res.status(403).json({ error: 'Forbidden: You can only access your own account data' });
    }

    // Find user in mock database
    const user = users.find(u => u.id === targetId);

    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    // Security: Strip sensitive fields (password, salt, etc.)
    const { password, ...safeUser } = user;

    res.json(safeUser);
});

module.exports = app;