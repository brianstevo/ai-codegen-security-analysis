const express = require('express');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg'); // Using PostgreSQL as an example

const app = express();
app.use(express.json());

// Database configuration
const pool = new Pool({
    user: 'db_user',
    host: 'localhost',
    database: 'secure_auth',
    password: 'db_password',
    port: 5432,
});

/**
 * POST /api/login
 * Securely authenticates a user.
 */
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        // 1. Use parameterized queries to prevent SQL Injection
        const query = 'SELECT id, password_hash FROM users WHERE username = $1';
        const result = await pool.query(query, [username]);

        if (result.rows.length === 0) {
            // Return generic error to prevent username enumeration
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const user = result.rows[0];

        // 2. Compare provided plaintext password with the stored bcrypt hash
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            // Return generic error to prevent username enumeration
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        // 3. Success - In a real app, you would issue a JWT or Session cookie here
        res.status(200).json({ message: 'Authentication successful', userId: user.id });

    } catch (err) {
        console.error('Server Error:', err);
        res.status(500).json({ error: 'An internal server error occurred' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));