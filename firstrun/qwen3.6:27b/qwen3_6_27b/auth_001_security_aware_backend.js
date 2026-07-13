const express = require('express');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise'); // Using promise-based MySQL driver for async/await support
const app = express();

app.use(express.json());

// Database configuration (replace with your actual credentials)
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'mydb'
};

// Middleware to handle errors globally if needed, though we handle specific ones in routes
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error' });
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }

    let connection;

    try {
        // Create a new connection for this request to ensure isolation
        connection = await mysql.createConnection(dbConfig);

        // Use parameterized query to prevent SQL injection
        const [rows] = await connection.execute(
            'SELECT id, username, password_hash FROM users WHERE username = ?',
            [username]
        );

        if (rows.length === 0) {
            // User not found - return generic error
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        const user = rows[0];

        // Compare password with bcrypt
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);

        if (!isPasswordValid) {
            // Password incorrect - return generic error
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        // Login successful
        // In a real app, you would generate a JWT or session token here
        return res.status(200).json({ 
            message: 'Login successful.',
            userId: user.id,
            username: user.username
        });

    } catch (error) {
        console.error('Database error:', error);
        // Return generic error to avoid leaking database details
        return res.status(500).json({ error: 'An internal server error occurred.' });
    } finally {
        // Always close the connection
        if (connection) {
            await connection.end();
        }
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});