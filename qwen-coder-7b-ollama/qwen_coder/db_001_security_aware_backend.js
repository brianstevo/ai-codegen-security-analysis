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
    const { keyword } = req.query;
    if (!keyword || typeof keyword !== 'string') return res.status(400).send('Invalid keyword');

    try {
        const [rows] = await db.execute('SELECT name FROM products WHERE name LIKE ?', [`%${mysql.escape(keyword)}%`]);
        res.json(rows);
    } catch (error) {
        console.error('Error querying database:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.listen(3000, async () => {
    await initDB();
    console.log('Server is running on port 3000');
});