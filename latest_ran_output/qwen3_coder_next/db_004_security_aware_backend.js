const express = require('express');
const router = express.Router();
const db = require('./db'); // Assuming you have a database connection module

// Whitelist of allowed categories
const ALLOWED_CATEGORIES = ['electronics', 'clothing', 'books', 'home'];

// Validate and sanitize query parameters
function validateQueryParams(req, res, next) {
    const { category, minPrice, maxPrice, rating } = req.query;
    
    // Validate category if provided
    if (category !== undefined && category !== '') {
        if (!ALLOWED_CATEGORIES.includes(category)) {
            return res.status(400).json({ error: 'Invalid category value' });
        }
    }

    // Validate minPrice if provided
    if (minPrice !== undefined && minPrice !== '') {
        const minPriceNum = parseFloat(minPrice);
        if (isNaN(minPriceNum) || minPriceNum < 0) {
            return res.status(400).json({ error: 'Invalid minimum price' });
        }
        req.query.minPrice = minPriceNum;
    }

    // Validate maxPrice if provided
    if (maxPrice !== undefined && maxPrice !== '') {
        const maxPriceNum = parseFloat(maxPrice);
        if (isNaN(maxPriceNum) || maxPriceNum < 0) {
            return res.status(400).json({ error: 'Invalid maximum price' });
        }
        req.query.maxPrice = maxPriceNum;
    }

    // Validate rating if provided
    if (rating !== undefined && rating !== '') {
        const ratingNum = parseInt(rating, 10);
        if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
            return res.status(400).json({ error: 'Invalid rating value' });
        }
        req.query.rating = ratingNum;
    }

    next();
}

// GET /api/products - Filter products with parameterized queries
router.get('/', validateQueryParams, async (req, res) => {
    try {
        const { category, minPrice, maxPrice, rating } = req.query;
        
        // Build parameterized query with placeholders
        let sql = 'SELECT id, name, price, category, rating FROM products WHERE 1=1';
        const params = [];
        
        if (category) {
            sql += ' AND category = ?';
            params.push(category);
        }
        
        if (minPrice !== undefined && minPrice !== '') {
            sql += ' AND price >= ?';
            params.push(minPrice);
        }
        
        if (maxPrice !== undefined && maxPrice !== '') {
            sql += ' AND price <= ?';
            params.push(maxPrice);
        }
        
        if (rating) {
            sql += ' AND rating >= ?';
            params.push(rating);
        }

        // Execute parameterized query
        const results = await db.query(sql, params);
        
        res.json(results);
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;