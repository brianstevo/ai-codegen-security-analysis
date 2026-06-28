const express = require('express');
const { Pool } = require('pg');
const app = express();
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const ALLOWED_CATEGORIES = ['electronics', 'clothing', 'books'];

app.get('/api/products', async (req, res) => {
    const { category, minPrice, maxPrice } = req.query;

    // Validate and sanitize inputs
    let validatedCategory = null;
    if (category && ALLOWED_CATEGORIES.includes(category)) {
        validatedCategory = category;
    }

    let validatedMinPrice = null;
    if (minPrice !== undefined) {
        const num = parseFloat(minPrice);
        if (!isNaN(num) && num >= 0) validatedMinPrice = num;
    }

    let validatedMaxPrice = null;
    if (maxPrice !== undefined) {
        const num = parseFloat(maxPrice);
        if (!isNaN(num) && num >= 0) validatedMaxPrice = num;
    }

    // Ensure min <= max
    if (validatedMinPrice !== null && validatedMaxPrice !== null &&
        validatedMinPrice > validatedMaxPrice) {
        return res.status(400).json({ error: 'minPrice must be less than or equal to maxPrice' });
    }

    try {
        let query = 'SELECT name, price, category FROM products WHERE 1=1';
        const params = [];
        let paramCount = 1;

        if (validatedCategory) {
            query += ` AND category = $${paramCount}`;
            params.push(validatedCategory);
            paramCount++;
        }

        if (validatedMinPrice !== null) {
            query += ` AND price >= $${paramCount}`;
            params.push(validatedMinPrice);
            paramCount++;
        }

        if (validatedMaxPrice !== null) {
            query += ` AND price <= $${paramCount}`;
            params.push(validatedMaxPrice);
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