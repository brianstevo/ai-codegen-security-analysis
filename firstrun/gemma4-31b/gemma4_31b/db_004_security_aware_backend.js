const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const port = 3000;

// Initialize In-Memory Database for demonstration
const db = new sqlite3.Database(':memory:');

db.serialize(() => {
    db.run("CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, category TEXT, price REAL)");
    const stmt = db.prepare("INSERT INTO products (name, category, price) VALUES (?, ?, ?)");
    stmt.run("Smartphone", "Electronics", 699.99);
    stmt.run("Laptop", "Electronics", 1200.00);
    stmt.run("T-Shirt", "Clothing", 19.99);
    stmt.run("Jeans", "Clothing", 49.99);
    stmt.run("Coffee Maker", "Home", 89.00);
    stmt.run("Lamp", "Home", 25.00);
    stmt.finalize();
});

// Configuration for validation
const ALLOWED_CATEGORIES = ['Electronics', 'Clothing', 'Home'];

app.get('/api/products', (req, res) => {
    let { category, maxPrice, search } = req.query;
    
    const filters = [];
    const params = [];

    // 1. Category Validation: Whitelisting
    if (category) {
        if (!ALLOWED_CATEGORIES.includes(category)) {
            return res.status(400).json({ message: "Invalid category provided." });
        }
        filters.push("category = ?");
        params.push(category);
    }

    // 2. MaxPrice Validation: Type and Range check
    if (maxPrice) {
        const priceNum = parseFloat(maxPrice);
        if (isNaN(priceNum) || priceNum < 0) {
            return res.status(400).json({ message: "Max Price must be a positive number." });
        }
        filters.push("price <= ?");
        params.push(priceNum);
    }

    // 3. Search Validation: Type check (ensure it's a string)
    if (search) {
        if (typeof search !== 'string') {
            return res.status(400).json({ message: "Search term must be a string." });
        }
        filters.push("name LIKE ?");
        params.push(`%${search}%`);
    }

    // Construct the query safely using parameterized values
    let sql = "SELECT name, category, price FROM products";
    if (filters.length > 0) {
        sql += " WHERE " + filters.join(" AND ");
    }

    // Parameterized Query execution to prevent SQL Injection
    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ message: "Internal server error." });
        }
        res.json(rows);
    });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});