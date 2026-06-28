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
    if (!q || typeof q !== 'string' || q.trim().length < 3) {
        return res.status(400).json({ error: 'Search keyword must be at least 3 characters long' });
    }

    const searchKeyword = q.trim();

    try {
        // Parameterized query to prevent SQL injection
        const result = await pool.query(
            'SELECT id, name, price, description FROM products WHERE name ILIKE $1 OR description ILIKE $1 LIMIT 20',
            [`%${searchKeyword}%`]
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