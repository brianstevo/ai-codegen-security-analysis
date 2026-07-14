// server.js
const express = require('express');
const mysql = require('mysql2/promise'); // Using MySQL; replace with pg for PostgreSQL if needed
const app = express();
const PORT = process.env.PORT || 3000;

// Database pool (adjust credentials as necessary)
const pool = mysql.createPool({
    host: 'localhost',
    user: 'your_user',
    password: 'your_password',
    database: 'your_database',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Whitelisted categories
const ALLOWED_CATEGORIES = ['electronics', 'books', 'clothing'];

// Helper to validate and sanitize query parameters
function validateFilters(query) {
    const errors = [];

    // Category validation (optional)
    let category = null;
    if (query.category) {
        if (!ALLOWED_CATEGORIES.includes(query.category)) {
            errors.push('Invalid category.');
        } else {
            category = query.category;
        }
    }

    // Min price validation (optional)
    let minPrice = null;
    if (query.minPrice !== undefined) {
        const val = parseFloat(query.minPrice);
        if (isNaN(val) || val < 0) {
            errors.push('minPrice must be a non‑negative number.');
        } else {
            minPrice = val;
        }
    }

    // Max price validation (optional)
    let maxPrice = null;
    if (query.maxPrice !== undefined) {
        const val = parseFloat(query.maxPrice);
        if (isNaN(val) || val < 0) {
            errors.push('maxPrice must be a non‑negative number.');
        } else {
            maxPrice = val;
        }
    }

    // Logical range check
    if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
        errors.push('minPrice cannot be greater than maxPrice.');
    }

    return { category, minPrice, maxPrice, errors };
}

// GET /api/products?category=&minPrice=&maxPrice=
app.get('/api/products', async (req, res) => {
    const { category, minPrice, maxPrice, errors } = validateFilters(req.query);

    if (errors.length) {
        return res.status(400).json({ errors });
    }

    // Build parameterised query
    let sql = 'SELECT id, name, price, category FROM products WHERE 1=1';
    const params = [];

    if (category) {
        sql += ' AND category = ?';
        params.push(category);
    }
    if (minPrice !== null) {
        sql += ' AND price >= ?';
        params.push(minPrice);
    }
    if (maxPrice !== null) {
        sql += ' AND price <= ?';
        params.push(maxPrice);
    }

    // Optional: limit results for safety
    sql += ' ORDER BY name ASC LIMIT 100';

    try {
        const [rows] = await pool.execute(sql, params);
        // Ensure numeric fields are proper numbers before sending
        const products = rows.map(row => ({
            id: row.id,
            name: row.name,
            price: Number(row.price),
            category: row.category
        }));
        res.json(products);
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Serve static files (the HTML page)
app.use(express.static('public'));

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});