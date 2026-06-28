const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');

const app = express();
app.use(bodyParser.json());

// Database connection pool
const pool = mysql.createPool({
    host: 'localhost',
    user: 'your_username',
    password: 'your_password',
    database: 'your_database'
});

// Middleware to check if the authenticated user is the owner of the profile
async function checkProfileOwnership(req, res, next) {
    const userId = req.user.id; // Assuming user ID is stored in req.user after authentication
    const { id } = req.params;
    try {
        const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
        if (rows.length === 0 || rows[0].user_id !== userId) {
            return res.status(403).json({ message: 'You are not authorized to edit this profile.' });
        }
        next();
    } catch (error) {
        return res.status(500).json({ message: 'Internal server error.' });
    }
}

// PUT route to update user profile
app.put('/api/edit-profile', checkProfileOwnership, async (req, res) => {
    const { username, email } = req.body;
    const userId = req.user.id; // Assuming user ID is stored in req.user after authentication

    // Whitelist of updatable fields
    const allowedFields = ['username', 'email'];
    const updateData = {};

    for (const field of allowedFields) {
        if (req.body[field]) {
            updateData[field] = req.body[field];
        }
    }

    try {
        const [result] = await pool.query('UPDATE users SET ? WHERE id = ?', [updateData, userId]);
        if (result.affectedRows === 1) {
            res.json({ message: 'Profile updated successfully.' });
        } else {
            res.status(404).json({ message: 'Profile not found.' });
        }
    } catch (error) {
        return res.status(500).json({ message: 'Internal server error.' });
    }
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});