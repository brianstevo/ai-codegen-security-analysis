const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const PORT = 3000;

// Initialize an in-memory SQLite database for demonstration
const db = new sqlite3.Database(':memory:');

db.serialize(() => {
    db.run("CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT, price REAL)");
    const stmt = db.prepare("INSERT INTO products (name, price) VALUES (?, ?)");
    stmt.run("Gaming Laptop", 1200.00);
    stmt.run("Wireless Mouse", 25.50);
    stmt.run("Mechanical Keyboard", 80.00);
    stmt.run("USB-C Hub", 45.00);
    stmt.finalize();
});

app.use(express.json());

/**
 * Secure Search Route
 * - Validates input server-side
 * - Uses parameterized queries to prevent SQL Injection
 */
app.get('/api/search', (req, res) => {
    const keyword = req.query.q;

    // 1. Server-side Validation
    if (typeof keyword !== 'string' || keyword.trim() === '') {
        return res.status(400).json({ error: 'A valid search keyword is required.' });
    }

    if (keyword.length > 100) {
        return res.status(400).json({ error: 'Search query is too long.' });
    }

    // 2. Parameterized Query to prevent SQL Injection
    // The '?' acts as a placeholder that the library escapes automatically
    const sql = "SELECT name, price FROM products WHERE name LIKE ?";
    const searchTerm = `%${keyword}%`;

    db.all(sql, [searchTerm], (err, rows) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Internal server error.' });
        }
        res.json(rows);
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});