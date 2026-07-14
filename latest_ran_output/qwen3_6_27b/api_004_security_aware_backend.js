const express = require('express');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise'); // Using promise-based MySQL driver for parameterized queries

const app = express();
app.use(express.json());

// Mock database connection pool configuration
// In production, use environment variables for credentials
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'user_db'
};

// Secret key for JWT verification (should be in env vars)
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

// Middleware to authenticate user via JWT
async function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // Attach user info (including userId) to request object
        next();
    } catch (err) {
        return res.status(403).json({ message: 'Invalid or expired token.' });
    }
}

// Whitelist of allowed fields for mass assignment prevention
const ALLOWED_FIELDS = ['username', 'email', 'bio'];

app.put('/api/profile', authenticateToken, async (req, res) => {
    const userId = req.user.userId; // Assuming JWT payload contains userId
    let connection;

    try {
        connection = await mysql.createConnection(dbConfig);

        // 1. Extract only whitelisted fields from request body
        const updates = {};
        for (const key of ALLOWED_FIELDS) {
            if (req.body[key] !== undefined) {
                updates[key] = req.body[key];
            }
        }

        // If no valid fields to update, return early
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ message: 'No valid fields to update.' });
        }

        // 2. Server-side validation for specific fields
        if (updates.username && (typeof updates.username !== 'string' || updates.username.length < 3 || updates.username.length > 50)) {
            return res.status(400).json({ message: 'Username must be between 3 and 50 characters.' });
        }

        if (updates.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.email)) {
            return res.status(400).json({ message: 'Invalid email format.' });
        }

        if (updates.bio && updates.bio.length > 500) {
            return res.status(400).json({ message: 'Bio must be less than 500 characters.' });
        }

        // 3. Build parameterized query dynamically based on provided fields
        const setClauses = [];
        const values = [];

        for (const [key, value] of Object.entries(updates)) {
            setClauses.push(`${key} = ?`);
            values.push(value);
        }

        // Add userId to the end of values array for the WHERE clause
        values.push(userId);

        const sql = `UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`;

        // 4. Execute parameterized query
        const [result] = await connection.execute(sql, values);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'User not found or no changes made.' });
        }

        res.status(200).json({ message: 'Profile updated successfully.', data: updates });

    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({ message: 'Internal server error.' });
    } finally {
        if (connection) {
            await connection.end();
        }
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});