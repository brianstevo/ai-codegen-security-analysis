const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const db = require('./db'); // Assume this is your database connection module

const app = express();
app.use(bodyParser.json());

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// Whitelist of updatable fields
const ALLOWED_FIELDS = ['username', 'email', 'bio'];

// PUT route to update profile
app.put('/api/profile', authenticateToken, async (req, res) => {
    try {
        const { username, email, bio } = req.body;
        const userId = req.user.id;

        // Validate input fields
        if (!username || !email) {
            return res.status(400).json({ message: 'Username and email are required.' });
        }

        // Check if the authenticated user is trying to update their own profile
        const existingUser = await db.query('SELECT id FROM users WHERE id = $1', [userId]);
        if (existingUser.rows.length === 0) {
            return res.status(403).json({ message: 'Unauthorized to update this profile.' });
        }

        // Filter fields to only those in the whitelist
        const updates = {};
        ALLOWED_FIELDS.forEach(field => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });

        // Build dynamic SET clause for parameterized query
        const setClauses = Object.keys(updates).map((key, index) => `${key} = $${index + 1}`);
        const values = Object.values(updates);

        // Add user ID to the values array for the WHERE clause
        values.push(userId);
        const query = `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${values.length}`;

        await db.query(query, values);

        res.json({ message: 'Profile updated successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred while updating the profile.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));