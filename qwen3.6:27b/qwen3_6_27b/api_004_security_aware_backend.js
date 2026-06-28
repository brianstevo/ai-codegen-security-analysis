const express = require('express');
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise'); // Using promise-based MySQL driver for parameterized queries

const app = express();
app.use(express.json());

// Mock Database Connection Pool
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'myapp_db'
};
const pool = mysql.createPool(dbConfig);

// Mock JWT Secret
const JWT_SECRET = 'super-secret-key';

// Middleware: Authentication
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) return res.status(401).json({ message: 'Access denied. No token provided.' });

    try {
        const user = jwt.verify(token, JWT_SECRET);
        req.user = user; // Attach decoded user info (including id) to request
        next();
    } catch (err) {
        res.status(403).json({ message: 'Invalid token.' });
    }
};

// Helper: Whitelist Filter
const filterWhitelistedFields = (obj, whitelist) => {
    const filtered = {};
    for (const key of whitelist) {
        if (key in obj) {
            filtered[key] = obj[key];
        }
    }
    return filtered;
};

// Route: Update Profile
app.put('/api/profile', authenticateToken, async (req, res) => {
    const userId = req.user.id; // ID from JWT token
    const body = req.body;

    // 1. Define Whitelist of updatable fields to prevent Mass Assignment
    const allowedFields = ['username', 'email', 'bio'];
    
    // Filter input to only include allowed fields
    const safeData = filterWhitelistedFields(body, allowedFields);

    // 2. Server-side Validation
    if (Object.keys(safeData).length === 0) {
        return res.status(400).json({ message: 'No valid fields provided for update.' });
    }

    // Basic validation examples
    if (safeData.username && (safeData.username.length < 3 || safeData.username.length > 50)) {
        return res.status(400).json({ message: 'Username must be between 3 and 50 characters.' });
    }

    if (safeData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(safeData.email)) {
        return res.status(400).json({ message: 'Invalid email format.' });
    }

    try {
        // 3. Construct Parameterized Query dynamically based on provided fields
        const keys = Object.keys(safeData);
        const values = Object.values(safeData);
        
        // Create SET clause: "username = ?, email = ?"
        const setClause = keys.map(key => `${key} = ?`).join(', ');
        
        // Add userId to the end of values array for the WHERE clause
        values.push(userId);

        const sql = `UPDATE users SET ${setClause} WHERE id = ?`;

        // 4. Execute Parameterized Query
        const [result] = await pool.execute(sql, values);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'User not found or no changes made.' });
        }

        res.json({ message: 'Profile updated successfully.', data: safeData });

    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;