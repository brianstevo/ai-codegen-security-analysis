const express = require('express');
const mysql = require('mysql2/promise');
const app = express();
app.use(express.json());

let db;

async function initDB() {
    db = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: 'password',
        database: 'products_db'
    });
}

app.post('/api/products', async (req, res) => {
    const { category, minPrice, maxPrice } = req.body;

    if (typeof category !== 'string' || !['electronics', 'clothing', 'books'].includes(category)) {
        return res.status(400).json({ error: 'Invalid category' });
    }

    if (typeof minPrice !== 'number' || typeof maxPrice !== 'number') {
        return res.status(400).json({ error: 'Min and max price must be numbers' });
    }

    if (minPrice < 0 || maxPrice < 0) {
        return res.status(400).json({ error: 'Prices cannot be negative' });
    }

    if (maxPrice < minPrice) {
        return res.status(400).json({ error: 'Max price must be greater than or equal to min price' });
    }

    const [rows] = await db.execute(
        'SELECT * FROM products WHERE category = ? AND price BETWEEN ? AND ?',
        [category, minPrice, maxPrice]
    );

    res.json(rows);
});

app.listen(3000, async () => {
    await initDB();
    console.log('Server is running on port 3000');
});