// server.js
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const mysql = require('mysql2/promise'); // using MySQL; replace with your DB driver

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

// ---- Database pool (adjust credentials) ----
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

// Helper to validate and parse query parameters
function validateFilters(query) {
    const errors = [];

    // Min price
    let minPrice = null;
    if (query.minPrice !== undefined) {
        minPrice = parseFloat(query.minPrice);
        if (isNaN(minPrice) || minPrice < 0) {
            errors.push('minPrice must be a non‑negative number');
        }
    }

    // Max price
    let maxPrice = null;
    if (query.maxPrice !== undefined) {
        maxPrice = parseFloat(query.maxPrice);
        if (isNaN(maxPrice) || maxPrice < 0) {
            errors.push('maxPrice must be a non‑negative number');
        }
    }

    // Price range logic
    if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
        errors.push('minPrice cannot be greater than maxPrice');
    }

    // Category
    let category = null;
    if (query.category) {
        if (!ALLOWED_CATEGORIES.includes(query.category)) {
            errors.push(`category must be one of: ${ALLOWED_CATEGORIES.join(', ')}`);
        } else {
            category = query.category;
        }
    }

    // Search term (optional, trimmed)
    let searchTerm = null;
    if (query.searchTerm) {
        searchTerm = query.searchTerm.trim();
        if (searchTerm.length === 0) searchTerm = null;
    }

    return { errors, filters: { minPrice, maxPrice, category, searchTerm } };
}

// ---- API route ----
app.get('/api/products', async (req, res) => {
    const { errors, filters } = validateFilters(req.query);
    if (errors.length) {
        return res.status(400).json({ error: errors.join('; ') });
    }

    // Build dynamic query with placeholders
    const sqlParts = ['SELECT id, name, description, price, category FROM products WHERE 1=1'];
    const params = [];

    if (filters.minPrice !== null) {
        sqlParts.push('AND price >= ?');
        params.push(filters.minPrice);
    }
    if (filters.maxPrice !== null) {
        sqlParts.push('AND price <= ?');
        params.push(filters.maxPrice);
    }
    if (filters.category) {
        sqlParts.push('AND category = ?');
        params.push(filters.category);
    }
    if (filters.searchTerm) {
        sqlParts.push('AND name LIKE ?');
        params.push(`%${filters.searchTerm}%`);
    }

    const finalSql = sqlParts.join(' ');

    try {
        const [rows] = await pool.execute(finalSql, params);
        // Convert price to Number for client side formatting
        const products = rows.map(r => ({
            id: r.id,
            name: r.name,
            description: r.description,
            price: Number(r.price),
            category: r.category
        }));
        res.json(products);
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ---- Start server ----
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});