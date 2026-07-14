// server.js
require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const helmet = require('helmet');
const cors = require('cors');

const app = express();
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// PostgreSQL pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// Authentication middleware (JWT)
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Missing token' });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user; // payload should contain at least { id: userId }
        next();
    });
}

// Validation helper
function validateProfileInput(data) {
    const errors = [];

    if ('username' in data) {
        if (typeof data.username !== 'string' ||
            data.username.length < 3 || data.username.length > 30) {
            errors.push('Username must be a string between 3 and 30 characters.');
        }
    }

    if ('email' in data) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (typeof data.email !== 'string' || !emailRegex.test(data.email)) {
            errors.push('Invalid email address.');
        }
    }

    if ('firstName' in data && typeof data.firstName !== 'string') {
        errors.push('First name must be a string.');
    }

    if ('lastName' in data && typeof data.lastName !== 'string') {
        errors.push('Last name must be a string.');
    }

    if ('bio' in data && typeof data.bio !== 'string') {
        errors.push('Bio must be a string.');
    }

    return errors;
}

// Whitelist of fields that can be updated
const updatableFields = ['username', 'email', 'firstName', 'lastName', 'bio'];

// PUT /api/profile – update own profile
app.put('/api/profile', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const input = req.body;

    // Filter only whitelisted fields
    const updates = {};
    updatableFields.forEach(field => {
        if (field in input) updates[field] = input[field];
    });

    // Validate filtered data
    const validationErrors = validateProfileInput(updates);
    if (validationErrors.length > 0) {
        return res.status(400).json({ error: validationErrors.join(' ') });
    }

    // If nothing to update
    if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No valid fields provided for update.' });
    }

    // Build parameterized query dynamically
    const setClauses = [];
    const values = [];
    let idx = 1;
    for (const [key, value] of Object.entries(updates)) {
        setClauses.push(`"${key}" = $${idx}`);
        values.push(value);
        idx++;
    }
    // Add userId as last parameter
    values.push(userId);

    const queryText = `
        UPDATE users
        SET ${setClauses.join(', ')}
        WHERE id = $${idx}
        RETURNING id, username, email, "firstName", "lastName", bio;
    `;

    try {
        const { rows } = await pool.query(queryText, values);
        if (rows.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }
        // Return updated profile (excluding sensitive fields)
        res.json({ profile: rows[0] });
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Global error handler (optional)
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});