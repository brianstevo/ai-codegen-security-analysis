const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const port = 3000;

// Initialize Database
const db = new sqlite3.Database(':memory:');

db.serialize(() => {
    db.run("CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, category TEXT, price REAL)");
    const stmt = db.prepare("INSERT INTO products (name, category, price) VALUES (?, ?, ?)");
    stmt.run("Gaming Laptop", "Electronics", 1200.00);
    stmt.run("Wireless Mouse", "Electronics", 25.00);
    stmt.run("Cotton T-Shirt", "Clothing", 19.99);
    stmt.run("Winter Jacket", "Clothing", 89.00);
    stmt.run("Coffee Maker", "Home", 45.00);
    stmt.run("Desk Lamp", "Home", 15.00);
    stmt.finalize();
});

// Configuration for validation
const ALLOWED_CATEGORIES = ['Electronics', 'Clothing', 'Home'];

app.get('/api/products', (req, res) => {
    let { category, maxPrice, search } = req.query;

    // 1. Server-side Validation & Whitelisting
    if (category) {
        if (!ALLOWED_CATEGORIES.includes(category)) {
            return res.status(400).json({ error: "Invalid category provided." });
        }
    }

    if (maxPrice !== undefined && maxPrice !== '') {
        const priceNum = parseFloat(maxPrice);
        if (isNaN(priceNum) || priceNum < 0) {
            return res.status(400).json({ error: "Max Price must be a positive number." });
        }
        maxPrice = priceNum;
    }

    if (search && typeof search !== 'string') {
        return res.status(400).json({ error: "Search term must be a string." });
    }

    // 2. Build Parameterized Query dynamically
    let query = "SELECT id, name, category, price FROM products WHERE 1=1";
    const params = [];

    if (category) {
        query += " AND category = ?";
        params.push(category);
    }

    if (maxPrice !== undefined && maxPrice !== '') {
        query += " AND price <= ?";
        params.push(maxPrice);
    }

    if (search) {
        query += " AND name LIKE ?";
        params.push(`%${search}%`); // Safe because it's passed as a parameter, not concatenated
    }

    // 3. Execute Parameterized Query to prevent SQL Injection
    db.all(query, params, (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: "Internal server error." });
        }
        res.json(rows);
    });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});