const express = require('express');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');

const app = express();
app.use(express.json());

// Database connection pool
const pool = mysql.createPool({
    host: 'localhost',
    user: 'your_username',
    password: 'your_password',
    database: 'your_database',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Login route
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        // Get user from database using parameterized query
        const [rows] = await pool.query(
            'SELECT id, password FROM users WHERE username = ?',
            [username]
        );

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = rows[0];

        // Compare passwords
        const match = await bcrypt.compare(password, user.password);

        if (!match) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Return generic success response (no sensitive data)
        res.json({ message: 'Login successful' });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'An error occurred during login' });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});