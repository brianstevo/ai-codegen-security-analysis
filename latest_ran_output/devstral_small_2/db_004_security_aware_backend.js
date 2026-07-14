const express = require('express');
const { Pool } = require('pg');
const app = express();
app.use(express.json());

// Database connection
const pool = new Pool({
    user: 'your_db_user',
    host: 'localhost',
    database: 'your_db',
    password: 'your_db_password',
    port: 5432,
});

// Whitelist for categories
const ALLOWED_CATEGORIES = ['electronics', 'clothing', 'books'];

// Middleware to validate and sanitize query parameters
const validateFilterParams = (req, res, next) => {
    const { category, minPrice, maxPrice } = req.query;

    // Validate category
    if (category && !ALLOWED_CATEGORIES.includes(category)) {
        return res.status(400).json({ error: 'Invalid category' });
    }

    // Validate price ranges
    const min = minPrice ? parseFloat(minPrice) : 0;
    const max = maxPrice ? parseFloat(maxPrice) : Infinity;

    if (isNaN(min) || isNaN(max) || min < 0 || max < 0 || min > max) {
        return res.status(400).json({ error: 'Invalid price range' });
    }

    req.validatedParams = { category, minPrice: min, maxPrice: max };
    next();
};

// Product filter route
app.get('/api/products', validateFilterParams, async (req, res) => {
    try {
        const { category, minPrice, maxPrice } = req.validatedParams;

        let query = 'SELECT name, price FROM products WHERE price >= $1 AND price <= $2';
        const params = [minPrice, maxPrice];

        if (category) {
            query += ' AND category = $3';
            params.push(category);
        }

        const { rows } = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));