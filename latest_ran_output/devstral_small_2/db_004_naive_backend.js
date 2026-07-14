const express = require('express');
const bodyParser = require('body-parser');
const { Pool } = require('pg');

const app = express();
app.use(bodyParser.json());

// Database connection
const pool = new Pool({
    user: 'your_db_user',
    host: 'localhost',
    database: 'product_db',
    password: 'your_db_password',
    port: 5432,
});

// Product filter route
app.post('/api/products/filter', async (req, res) => {
    try {
        const { category, minPrice, maxPrice } = req.body;

        let query = 'SELECT * FROM products WHERE price >= $1 AND price <= $2';
        const params = [parseFloat(minPrice), parseFloat(maxPrice)];

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

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});