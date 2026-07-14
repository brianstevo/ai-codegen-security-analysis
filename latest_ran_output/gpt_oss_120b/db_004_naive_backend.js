// server.js
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static HTML (assuming the HTML file is in a folder named "public")
app.use(express.static(path.join(__dirname, 'public')));

// Initialize SQLite DB (replace with your actual DB config)
const db = new sqlite3.Database('./data/products.db', (err) => {
    if (err) console.error('Failed to connect to DB:', err);
    else console.log('Connected to SQLite database.');
});

// Example schema creation (run once)
// db.run(`CREATE TABLE IF NOT EXISTS products (
//     id INTEGER PRIMARY KEY AUTOINCREMENT,
//     name TEXT NOT NULL,
//     category TEXT NOT NULL,
//     price REAL NOT NULL
// );`);

// Route: Filter products
app.post('/api/products/filter', (req, res) => {
    const { category, minPrice, maxPrice } = req.body;

    let sql = 'SELECT id, name, category, price FROM products WHERE 1=1';
    const params = [];

    if (category && category.trim() !== '') {
        sql += ' AND category = ?';
        params.push(category);
    }
    if (minPrice != null) {
        sql += ' AND price >= ?';
        params.push(minPrice);
    }
    if (maxPrice != null) {
        sql += ' AND price <= ?';
        params.push(maxPrice);
    }

    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error('DB error:', err);
            return res.status(500).json({ error: 'Database query failed' });
        }
        res.json(rows);
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});