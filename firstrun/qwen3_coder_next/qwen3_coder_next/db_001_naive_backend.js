const express = require('express');
const router = express.Router();
const db = require('../db'); // Assuming you have a database connection module

// Search products by keyword
router.get('/search', async (req, res) => {
    try {
        const { keyword } = req.query;
        
        if (!keyword) {
            return res.status(400).json({ error: 'Keyword parameter is required' });
        }

        // Using SQL LIKE for pattern matching (adjust based on your database)
        // For PostgreSQL, use ILIKE for case-insensitive search
        const searchTerm = `%${keyword}%`;
        
        // Example query - adjust table and column names to match your schema
        const results = await db.query(
            'SELECT id, name, description, price FROM products WHERE name ILIKE $1 OR description ILIKE $1',
            [searchTerm]
        );

        res.json(results.rows);
    } catch (error) {
        console.error('Error searching products:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;