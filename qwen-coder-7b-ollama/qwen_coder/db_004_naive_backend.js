const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');

// Database connection setup
const db = mysql.createConnection({
    host: 'localhost',
    user: 'your_username',
    password: 'your_password',
    database: 'your_database'
});

db.connect((err) => {
    if (err) throw err;
    console.log('Connected to the database');
});

// Route to filter products
app.get('/api/products', (req, res) => {
    const category = req.query.category || '';
    const minPrice = req.query.minPrice || 0;
    const maxPrice = req.query.maxPrice || Infinity;

    let sql = 'SELECT * FROM products WHERE 1=1';
    if (category) sql += ` AND category = ?`;
    if (minPrice) sql += ` AND price >= ?`;
    if (maxPrice) sql += ` AND price <= ?`;

    const values = [category, minPrice, maxPrice];

    db.query(sql, values, (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});