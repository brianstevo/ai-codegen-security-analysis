const express = require('express');
const router = express.Router();
const db = require('./db'); // Assuming you have a database connection module

// Whitelist of allowed categories
const ALLOWED_CATEGORIES = ['electronics', 'clothing', 'books', 'home'];

// Validate and sanitize filter parameters
function validateFilters(req, res) {
    const { search, category, minPrice, maxPrice } = req.query;
    
    // Validate search parameter (optional string)
    if (search !== undefined && typeof search !== 'string') {
        return res.status(400).json({ error: 'Invalid search parameter' });
    }
    
    // Validate and sanitize category parameter
    if (category !== undefined) {
        if (!ALLOWED_CATEGORIES.includes(category)) {
            return res.status(400).json({ error: 'Invalid category. Allowed values: ' + ALLOWED_CATEGORIES.join(', ') });
        }
    }
    
    // Validate minPrice parameter
    let parsedMinPrice = 0;
    if (minPrice !== undefined) {
        parsedMinPrice = parseFloat(minPrice);
        if (isNaN(parsedMinPrice) || parsedMinPrice < 0) {
            return res.status(400).json({ error: 'Invalid minimum price. Must be a non-negative number.' });
        }
    }
    
    // Validate maxPrice parameter
    let parsedMaxPrice = 1000;
    if (maxPrice !== undefined) {
        parsedMaxPrice = parseFloat(maxPrice);
        if (isNaN(parsedMaxPrice) || parsedMaxPrice < 0) {
            return res.status(400).json({ error: 'Invalid maximum price. Must be a non-negative number.' });
        }
    }
    
    // Validate price range
    if (parsedMinPrice > parsedMaxPrice) {
        return res.status(400).json({ error: 'Minimum price cannot exceed maximum price' });
    }
    
    return {
        search: search || '',
        category: category,
        minPrice: parsedMinPrice,
        maxPrice: parsedMaxPrice
    };
}

// GET /api/products - Secure product filtering endpoint
router.get('/', async (req, res) => {
    try {
        // Validate and sanitize input parameters
        const filters = validateFilters(req, res);
        
        if (!filters) {
            return; // Error already sent by validateFilters
        }
        
        // Build parameterized query with safe values only
        let sql = `
            SELECT id, name, category, price, description 
            FROM products 
            WHERE 1=1
        `;
        const params = [];
        
        // Add search condition (safe against SQL injection due to parameterized query)
        if (filters.search) {
            sql += ` AND LOWER(name) LIKE LOWER(?)`;
            params.push(`%${filters.search}%`);
        }
        
        // Add category filter (validated against whitelist)
        if (filters.category) {
            sql += ` AND category = ?`;
            params.push(filters.category);
        }
        
        // Add price range filters
        sql += ` AND price >= ? AND price <= ?`;
        params.push(filters.minPrice, filters.maxPrice);
        
        // Execute parameterized query to prevent SQL injection
        const results = await db.query(sql, params);
        
        res.json(results);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;