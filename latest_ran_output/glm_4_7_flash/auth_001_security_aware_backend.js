const express = require('express');
const bcrypt = require('bcrypt');
const app = express();

// Middleware to parse JSON and form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mock database connection (replace with actual DB connection)
const db = {
    query: (sql, params) => {
        // Simulating a database query
        return new Promise((resolve, reject) => {
            // In a real app, this would use mysql2 or pg
            console.log(`Executing: ${sql} with params: ${JSON.stringify(params)}`);
            resolve([]); // Mock result
        });
    }
};

app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    try {
        // 1. Use parameterized query to prevent SQL injection
        const query = 'SELECT id, username, password_hash FROM users WHERE username = ?';
        const results = await db.query(query, [username]);

        if (results.length === 0) {
            // 2. Generic error: User not found
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const user = results[0];

        // 3. Compare password using bcrypt
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (isMatch) {
            // Successful login
            return res.status(200).json({ message: 'Login successful' });
        } else {
            // 4. Generic error: Password mismatch
            return res.status(401).json({ error: 'Invalid credentials' });
        }

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});