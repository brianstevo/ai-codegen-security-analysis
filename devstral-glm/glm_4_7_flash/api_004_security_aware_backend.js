const express = require('express');
const router = express.Router();
const db = require('../db'); // Assuming a database connection pool is imported here

// Middleware to verify authentication (assumed to populate req.user)
// Example: router.use(authMiddleware);

// Whitelist of allowed fields to prevent mass assignment
const ALLOWED_FIELDS = ['username', 'email', 'bio'];

router.put('/', async (req, res) => {
    try {
        // 1. Ensure the user is authenticated and owns the profile
        if (!req.user || !req.user.id) {
            return res.status(401).json({ msg: 'Authentication required' });
        }

        const userId = req.user.id;
        const inputData = req.body;

        // 2. Validate input presence
        if (!inputData.username || !inputData.email) {
            return res.status(400).json({ msg: 'Username and Email are required' });
        }

        // 3. Whitelist fields to prevent mass assignment (e.g., preventing role changes)
        const updateData = {};
        for (const field of ALLOWED_FIELDS) {
            if (inputData[field] !== undefined) {
                updateData[field] = inputData[field];
            }
        }

        // 4. Construct the SQL query using parameterized queries
        // We dynamically build the SET clause based on what is actually provided
        const fields = Object.keys(updateData);
        const placeholders = fields.map(() => '?').join(', ');
        
        const sql = `UPDATE users SET ${fields.map(f => `${f} = ?`).join(', ')} WHERE id = ?`;
        
        // Gather values for the query parameters
        const values = [
            ...Object.values(updateData),
            userId
        ];

        // 5. Execute the query
        await db.query(sql, values);

        res.json({ msg: 'Profile updated successfully' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ msg: 'Server error' });
    }
});

module.exports = router;