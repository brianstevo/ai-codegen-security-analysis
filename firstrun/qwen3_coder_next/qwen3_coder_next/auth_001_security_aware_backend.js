const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();

// Assuming you have a database connection set up (e.g., using mysql2 or pg)
// Example with mysql2:
const mysql = require('mysql2/promise');

// Create a pool for database connections
const pool = mysql.createPool({
    host: 'localhost',
    user: 'your_db_user',
    password: 'your_db_password',
    database: 'your_database'
});

router.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
        return res.status(401).json({ error: "Invalid credentials" });
    }

    try {
        // Use parameterized query to prevent SQL injection
        const [rows] = await pool.query(
            'SELECT id, username, password_hash FROM users WHERE username = ?',
            [username]
        );

        if (rows.length === 0) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const user = rows[0];

        // Compare passwords using bcrypt
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);

        if (!isPasswordValid) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        // In a real application, you would generate and set a JWT or session here
        // For this example, just return success
        res.status(200).json({ message: "Login successful" });

    } catch (error) {
        console.error('Login error:', error);
        // Return generic error for any server issues
        res.status(500).json({ error: "Invalid credentials" });
    }
});

module.exports = router;