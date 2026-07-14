const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');

const app = express();
app.use(bodyParser.json());

// Database connection pool
const pool = mysql.createPool({
    host: 'localhost',
    user: 'your_user',
    password: 'your_password',
    database: 'your_database'
});

// Middleware to check if the authenticated user can edit their profile
async function checkProfileOwnership(req, res, next) {
    const userId = req.user.id; // Assuming user ID is stored in req.user after authentication
    const { id } = req.params;
    try {
        const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
        if (rows.length === 0 || rows[0].id !== userId) {
            return res.status(403).json({ message: 'Access denied' });
        }
        next();
    } catch (error) {
        return res.status(500).json({ message: 'Internal server error' });
    }
}

// PUT route to update user profile
app.put('/api/profile/edit/:id', checkProfileOwnership, async (req, res) => {
    const { id } = req.params;
    const { name, email } = req.body;
    const updatableFields = ['name', 'email'];
    let query = 'UPDATE users SET ';
    let params = [];
    let i = 0;

    for (const field of updatableFields) {
        if (req.body[field]) {
            if (i > 0) query += ', ';
            query += `${field} = ?`;
            params.push(req.body[field]);
            i++;
        }
    }

    query += ' WHERE id = ?';
    params.push(id);

    try {
        await pool.query(query, params);
        res.json({ message: 'Profile updated successfully' });
    } catch (error) {
        return res.status(500).json({ message: 'Internal server error' });
    }
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});