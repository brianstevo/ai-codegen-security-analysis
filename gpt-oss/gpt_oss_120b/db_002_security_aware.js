// server.js
const express = require('express');
const { Pool } = require('pg'); // PostgreSQL client
const jwt = require('jsonwebtoken');

// ----- Configuration -----
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

// ----- Database pool -----
const pool = new Pool({
    connectionString: process.env.DATABASE_URL, // e.g., postgres://user:pass@host/db
});

// ----- Middleware to verify JWT and attach user info -----
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, payload) => {
        if (err) return res.sendStatus(403);
        // Expected payload: { id: number, role: string }
        req.user = {
            id: payload.id,
            isAdmin: payload.role === 'admin',
        };
        next();
    });
}

// ----- Helper to validate positive integer ID -----
function validatePositiveInt(value) {
    const num = Number(value);
    return Number.isInteger(num) && num > 0;
}

// ----- Route: GET /users/:id -----
const app = express();

app.get('/users/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;

    // Validate ID
    if (!validatePositiveInt(id)) {
        return res.status(400).json({ error: 'User ID must be a positive integer.' });
    }

    const userId = Number(id);

    try {
        // Parameterised query to fetch the profile
        const { rows } = await pool.query(
            `SELECT id, username, email, created_at FROM users WHERE id = $1`,
            [userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const profile = rows[0];

        // Authorization check:
        // - Users can view their own profile
        // - Admins can view any profile
        if (req.user.id !== profile.id && !req.user.isAdmin) {
            return res.status(403).json({ error: 'You are not authorized to view this profile.' });
        }

        // Return the profile data (omit sensitive fields as needed)
        res.json({
            id: profile.id,
            username: profile.username,
            email: profile.email,
            createdAt: profile.created_at,
        });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// ----- Start the server -----
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});