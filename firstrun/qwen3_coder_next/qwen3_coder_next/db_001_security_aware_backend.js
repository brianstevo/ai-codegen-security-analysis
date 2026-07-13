const express = require('express');
const router = express.Router();

// Simulated database connection with parameterized queries support
// In production, use a real database library like pg (PostgreSQL) or mysql2 (MySQL)
class Database {
    constructor() {
        // Sample products for demonstration - in production this would be your actual DB
        this.products = [
            { id: 1, name: 'Laptop', price: 999.99 },
            { id: 2, name: 'Smartphone', price: 699.50 },
            { id: 3, name: 'Headphones', price: 149.99 },
            { id: 4, name: 'Keyboard', price: 79.99 },
            { id: 5, name: 'Mouse', price: 29.99 }
        ];
    }

    // Simulate parameterized query to prevent SQL injection
    async searchProducts(keyword) {
        // In production with real DB:
        // const result = await db.query(
        //   'SELECT * FROM products WHERE name ILIKE $1',
        //   [`%${keyword}%`]
        // );
        
        // Simulate the parameterized behavior for demo purposes
        if (!keyword) return [];
        
        // Case-insensitive search with safe regex pattern
        const pattern = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        
        return this.products.filter(product => 
            product.name.toLowerCase().includes(keyword.toLowerCase())
        );
    }
}

const db = new Database();

// Server-side validation function
function validateSearchKeyword(keyword) {
    // Validate input is a string and not empty
    if (typeof keyword !== 'string') {
        throw new Error('Invalid search keyword');
    }

    // Trim whitespace
    const trimmedKeyword = keyword.trim();
    
    // Check for minimum length
    if (trimmedKeyword.length < 1) {
        throw new Error('Search keyword cannot be empty');
    }
    
    // Limit maximum length to prevent abuse
    if (trimmedKeyword.length > 100) {
        throw new Error('Search keyword too long');
    }

    // Check for potentially dangerous patterns (basic XSS prevention)
    const dangerousPatterns = [
        /<script/i,
        /javascript:/i,
        /on\w+\s*=/i,
        /</,
        />/
    ];

    if (dangerousPatterns.some(pattern => pattern.test(trimmedKeyword))) {
        throw new Error('Invalid characters in search keyword');
    }

    return trimmedKeyword;
}

// Search endpoint
router.post('/search', async (req, res) => {
    try {
        // Validate and sanitize input server-side
        const { keyword } = req.body;
        
        if (!keyword) {
            return res.status(400).json({ message: 'Search keyword is required' });
        }

        // Server-side validation
        const safeKeyword = validateSearchKeyword(keyword);

        // Use parameterized query (simulated)
        const products = await db.searchProducts(safeKeyword);
        
        // Return results safely
        res.json(products);
    } catch (error) {
        console.error('Search error:', error.message);
        res.status(400).json({ message: error.message });
    }
});

module.exports = router;