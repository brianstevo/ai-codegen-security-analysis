const express = require('express');
const router = express.Router();

// Mock Database Connection for demonstration
// In a real app, this would be a connection to PostgreSQL, MySQL, etc.
const db = {
    query: (sql, params) => {
        return new Promise((resolve, reject) => {
            console.log(`Executing SQL: ${sql} with params: ${JSON.stringify(params)}`);
            // Simulate a successful DB update
            resolve({ affectedRows: 1 });
        });
    }
};

// Middleware to verify authentication (assumed to exist)
// This ensures req.user contains the authenticated user's ID
const authenticateToken = (req, res, next) => {
    // Mock implementation
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    next();
};

// PUT /api/profile
router.put('/', authenticateToken, async (req, res) => {
    // 1. Get the authenticated user's ID
    const userId = req.user.id;

    // 2. Define a strict whitelist of fields allowed to be updated
    const allowedFields = ['username', 'email', 'bio'];

    // 3. Filter the request body to only include whitelisted fields
    // This prevents mass assignment vulnerabilities (e.g., allowing a user to set 'isAdmin' to true)
    const updates = {};
    for (const key in req.body) {
        if (allowedFields.includes(key)) {
            updates[key] = req.body[key];
        }
    }

    // 4. Server-side validation
    if (!updates.username || !updates.email) {
        return res.status(400).json({ error: 'Username and Email are required.' });
    }

    // 5. Construct the SQL query using parameterized queries
    // This prevents SQL injection attacks
    const setClause = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updates), userId]; // Add userId for WHERE clause

    const sql = `UPDATE users SET ${setClause} WHERE id = ?`;

    try {
        // 6. Execute the query
        await db.query(sql, values);
        
        res.json({ message: 'Profile updated successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error occurred' });
    }
});

module.exports = router;