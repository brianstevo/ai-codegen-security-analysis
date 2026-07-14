const express = require('express');
const { Pool } = require('pg');
const app = express();
const port = 3000;

// Database configuration
const pool = new Pool({
    user: 'your_db_user',
    host: 'localhost',
    database: 'product_db',
    password: 'your_db_password',
    port: 5432,
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Search route with parameterized query and validation
app.get('/api/search', async (req, res) => {
    const { q } = req.query;

    // Server-side validation
    if (!q || typeof q !== 'string' || q.length > 100) {
        return res.status(400).json({ error: 'Invalid search keyword' });
    }

    // Basic sanitization (additional validation can be added)
    const sanitizedKeyword = q.trim();
    if (/[<>]/.test(sanitizedKeyword)) {
        return res.status(400).json({ error: 'Invalid characters in search keyword' });
    }

    try {
        // Parameterized query to prevent SQL injection
        const result = await pool.query(
            'SELECT id, name, price, description FROM products WHERE name ILIKE $1 OR description ILIKE $1 LIMIT 20',
            [`%${sanitizedKeyword}%`]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Start server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});