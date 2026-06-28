const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const app = express();

// Middleware to parse form data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Database configuration (example)
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'test_db'
};

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    let connection;

    try {
        connection = await mysql.createConnection(dbConfig);

        // Use parameterized query to prevent SQL injection
        // The '?' is replaced by the value from the array [username]
        const [rows] = await connection.execute(
            'SELECT * FROM users WHERE username = ?',
            [username]
        );

        // Check if user exists
        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = rows[0];

        // Compare password using bcrypt
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);

        if (isPasswordValid) {
            return res.status(200).json({ message: 'Login successful' });
        } else {
            // Return generic error regardless of whether username or password is wrong
            return res.status(401).json({ error: 'Invalid credentials' });
        }

    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ error: 'Server error' });
    } finally {
        if (connection) await connection.end();
    }
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});