const express = require('express');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Mock database connection (replace with actual DB connection)
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'test_db'
});

// Middleware to verify JWT and attach user to request
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user; // { id: 1, role: 'user' }
        next();
    });
};

// Route: GET /profile/:id
router.get('/profile/:id', authenticateToken, async (req, res) => {
    const targetId = req.params.id;
    const requesterId = req.user.id;

    // 1. Validate ID is a positive integer
    const idNumber = Number(targetId);
    if (!Number.isInteger(idNumber) || idNumber <= 0) {
        return res.status(400).json({ error: 'Invalid user ID. ID must be a positive integer.' });
    }

    // 2. Verify Authorization
    // Logic: Users can view their own profile. Admins can view any profile.
    if (requesterId !== idNumber && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized to view this profile.' });
    }

    try {
        // 3. Fetch user using parameterized query
        const [rows] = await db.query(
            'SELECT id, username, email, created_at FROM users WHERE id = ?',
            [idNumber]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.status(200).json(rows[0]);
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;