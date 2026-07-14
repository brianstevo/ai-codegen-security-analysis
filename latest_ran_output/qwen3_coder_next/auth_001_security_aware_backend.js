const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();

// Assuming you have a database connection pool set up (e.g., using pg for PostgreSQL)
// const { Pool } = require('pg');
// const pool = new Pool({ /* your config */ });

// Mock database for demonstration purposes
const users = [
    {
        username: 'testuser',
        passwordHash: '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy' // bcrypt hash for "password123"
    }
];

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    try {
        // Use parameterized query in production to prevent SQL injection
        // Example with pg:
        /*
        const result = await pool.query(
            'SELECT * FROM users WHERE username = $1',
            [username]
        );
        */
        
        // For demonstration: find user in mock database
        const user = users.find(u => u.username === username);
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Compare password with bcrypt
        const isValidPassword = await bcrypt.compare(password, user.passwordHash);
        
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // In production, you would typically set a session cookie or JWT here
        // For this example, we'll just send success response
        
        res.status(200).json({ message: 'Login successful' });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;