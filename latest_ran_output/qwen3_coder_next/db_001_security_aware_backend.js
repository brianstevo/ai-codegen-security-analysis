const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');

// Simulated database connection with parameterized queries
// In production, replace with actual database connection (e.g., pg for PostgreSQL)
const db = {
    query: (sql, params) => {
        // Mock implementation - in real app this would use a DB library
        // Example using pg: return pool.query(sql, params);
        
        // For demo purposes, we'll simulate a database with an array
        const mockProducts = [
            { id: 1, name: 'Laptop', price: 999.99 },
            { id: 2, name: 'Smartphone', price: 699.50 },
            { id: 3, name: 'Headphones', price: 149.99 },
            { id: 4, name: 'Keyboard', price: 79.99 },
            { id: 5, name: 'Mouse', price: 29.99 }
        ];
        
        // Simulate parameterized query by filtering the mock data
        const keyword = params[0].replace(/%/g, '').toLowerCase();
        const results = mockProducts.filter(p => 
            p.name.toLowerCase().includes(keyword)
        );
        
        return { rows: results };
    }
};

// Server-side validation for search keyword
router.post('/search', [
    body('keyword')
        .trim()
        .isLength({ min: 1, max: 100 })
        .withMessage('Search term must be between 1 and 100 characters')
        .matches(/^[a-zA-Z0-9\s\-_.]+$/)
        .withMessage('Search term contains invalid characters')
], async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ 
            message: 'Invalid search term',
            errors: errors.array()
        });
    }

    try {
        // Extract and sanitize the keyword
        const { keyword } = req.body;
        
        // Additional server-side sanitization
        const sanitizedKeyword = keyword.trim().toLowerCase();
        
        // Use parameterized query to prevent SQL injection
        // The ? placeholder is replaced with the sanitized value safely
        const sql = `
            SELECT id, name, price 
            FROM products 
            WHERE LOWER(name) LIKE LOWER($1)
            LIMIT 50
        `;
        
        // Pass the parameter as part of an array for parameterized query
        const result = db.query(sql, [`%${sanitizedKeyword}%`]);
        
        res.json({ 
            products: result.rows,
            count: result.rows.length
        });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

module.exports = router;