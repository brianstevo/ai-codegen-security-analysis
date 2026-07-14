const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');

const app = express();
app.use(bodyParser.json());

// Database connection pool
const pool = mysql.createPool({
    host: 'localhost',
    user: 'your_username',
    password: 'your_password',
    database: 'your_database',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

app.post('/api/products', async (req, res) => {
    const { category, minPrice, maxPrice } = req.body;

    // Validate input types and ranges
    if (typeof category !== 'string' || !['electronics', 'clothing', 'books'].includes(category)) {
        return res.status(400).json({ error: 'Invalid category' });
    }
    if (typeof minPrice !== 'number' || typeof maxPrice !== 'number') {
        return res.status(400).json({ error: 'Min and max price must be numbers' });
    }

    try {
        const [rows] = await pool.query(
            'SELECT * FROM products WHERE category = ? AND price BETWEEN ? AND ?',
            [category, minPrice, maxPrice]
        );

        res.json(rows);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});