const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');

const app = express();
app.use(bodyParser.json());

// Database connection pool
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root', // replace with your DB username
    password: '', // replace with your DB password
    database: 'product_db', // replace with your database name
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Product search route
app.get('/api/products/search', async (req, res) => {
    try {
        const keyword = req.query.q;
        if (!keyword) {
            return res.status(400).json({ error: 'Search keyword is required' });
        }

        // Search for products matching the keyword in name or description
        const [rows] = await pool.query(
            `SELECT id, name, description, price
             FROM products
             WHERE name LIKE ? OR description LIKE ?
             LIMIT 20`,
            [`%${keyword}%`, `%${keyword}%`]
        );

        res.json(rows);
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});