const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');

// Database connection setup
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'products_db'
});

db.connect((err) => {
    if (err) throw err;
    console.log('Connected to the database');
});

app.get('/api/products', (req, res) => {
    const category = req.query.category || '';
    const minPrice = req.query.minPrice || 0;
    const maxPrice = req.query.maxPrice || Infinity;

    let query = 'SELECT * FROM products WHERE price BETWEEN ? AND ?';
    if (category) {
        query += ' AND category = ?';
    }

    db.query(query, [minPrice, maxPrice, category], (err, results) => {
        if (err) throw err;
        res.json(results);
    });
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});