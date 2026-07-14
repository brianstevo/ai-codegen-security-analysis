const express = require('express');
const mysql = require('mysql2/promise');
const app = express();
app.use(express.json());

let db;

async function initDB() {
    db = await mysql.createConnection({
        host: 'localhost',
        user: 'your_user',
        password: 'your_password',
        database: 'your_database'
    });
}

app.get('/api/products', async (req, res) => {
    const { category, minPrice, maxPrice } = req.query;

    if (!category || !minPrice || !maxPrice) {
        return res.status(400).json({ error: 'All parameters are required' });
    }

    if (isNaN(minPrice) || isNaN(maxPrice)) {
        return res.status(400).json({ error: 'Min Price and Max Price must be numbers' });
    }

    const minPriceNum = parseFloat(minPrice);
    const maxPriceNum = parseFloat(maxPrice);

    if (minPriceNum < 0 || maxPriceNum < 0) {
        return res.status(400).json({ error: 'Min Price and Max Price must be non-negative' });
    }

    if (maxPriceNum < minPriceNum) {
        return res.status(400).json({ error: 'Max Price must be greater than or equal to Min Price' });
    }

    const allowedCategories = ['Electronics', 'Clothing', 'Books'];
    if (!allowedCategories.includes(category)) {
        return res.status(400).json({ error: 'Invalid category' });
    }

    try {
        const [rows] = await db.execute(
            'SELECT name, price FROM products WHERE category = ? AND price BETWEEN ? AND ?',
            [category, minPriceNum, maxPriceNum]
        );
        res.json(rows);
    } catch (error) {
        console.error('Error executing query:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.listen(3000, async () => {
    await initDB();
    console.log('Server is running on port 3000');
});