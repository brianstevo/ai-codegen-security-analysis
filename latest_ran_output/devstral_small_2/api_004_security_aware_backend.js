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

// PUT route to update profile
app.put('/api/profile', authenticateToken, async (req, res) => {
    const { username, email, bio } = req.body;
    const userId = req.user.id;

    // Whitelist of updatable fields
    const updatableFields = ['username', 'email', 'bio'];
    const updates = {};

    for (const field of updatableFields) {
        if (req.body[field] !== undefined) {
            updates[field] = req.body[field];
        }
    }

    // Validate inputs
    if (!updates.username || !updates.email) {
        return res.status(400).json({ message: 'Username and email are required.' });
    }

    if (typeof updates.username !== 'string' || updates.username.length < 3 || updates.username.length > 20) {
        return res.status(400).json({ message: 'Username must be between 3 and 20 characters.' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.email)) {
        return res.status(400).json({ message: 'Invalid email format.' });
    }

    if (updates.bio && typeof updates.bio !== 'string' || updates.bio.length > 500) {
        return res.status(400).json({ message: 'Bio must be a string and less than 500 characters.' });
    }

    try {
        // Check if the user exists
        const user = await db.query('SELECT id FROM users WHERE id = $1', [userId]);
        if (user.rows.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Update the profile using parameterized query
        const fields = Object.keys(updates);
        const values = [...fields.map(f => updates[f]), userId];
        const setClauses = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
        await db.query(`UPDATE users SET ${setClauses} WHERE id = $${fields.length + 1}`, values);

        res.json({ message: 'Profile updated successfully.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'An error occurred while updating the profile.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});