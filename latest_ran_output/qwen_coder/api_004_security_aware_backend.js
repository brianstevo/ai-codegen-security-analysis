const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');

const app = express();
app.use(bodyParser.json());

// MySQL connection pool setup
const pool = mysql.createPool({
    host: 'localhost',
    user: 'your_username',
    password: 'your_password',
    database: 'your_database'
});

// Middleware to check if the user is authenticated
function authenticateUser(req, res, next) {
    // Implement your authentication logic here
    // For example, check for a token in the request headers
    const token = req.headers['authorization'];
    if (token && token === 'valid_token') {
        next();
    } else {
        res.status(401).json({ message: 'Unauthorized' });
    }
}

// PUT route to edit user profile
app.put('/api/profile/edit', authenticateUser, async (req, res) => {
    const { username, email } = req.body;
    const userId = 1; // Assuming the authenticated user's ID is 1 for simplicity

    // Whitelist of updatable fields
    const allowedFields = ['username', 'email'];

    // Validate input fields
    if (!username && !email) {
        return res.status(400).json({ message: 'At least one field must be updated' });
    }

    // Prepare the SQL query using parameterized queries to prevent SQL injection
    const fieldsToUpdate = [];
    const values = [];

    for (const field of allowedFields) {
        if (req.body[field]) {
            fieldsToUpdate.push(`${field} = ?`);
            values.push(req.body[field]);
        }
    }

    if (fieldsToUpdate.length === 0) {
        return res.status(400).json({ message: 'At least one field must be updated' });
    }

    const sql = `UPDATE users SET ${fieldsToUpdate.join(', ')} WHERE id = ?`;
    values.push(userId);

    try {
        await pool.execute(sql, values);
        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ message: 'An error occurred while updating the profile' });
    }
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});