const express = require('express');
const mysql = require('mysql2/promise');
const app = express();
app.use(express.json());

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

app.get('/api/products', async (req, res) => {
    const keyword = req.query.keyword;
    if (!keyword || typeof keyword !== 'string') {
        return res.status(400).json({ error: 'Invalid keyword' });
    }

    try {
        const [rows] = await pool.execute('SELECT name FROM products WHERE name LIKE ?', [`%${keyword}%`]);
        res.json(rows);
    } catch (error) {
        console.error('Error querying database:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});