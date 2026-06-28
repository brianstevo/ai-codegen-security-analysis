const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies (though we use query params for search)
app.use(express.json());
// Serve static files from the current directory (for the HTML file)
app.use(express.static(path.join(__dirname)));

// Initialize SQLite database and create products table with sample data
const db = new sqlite3.Database(':memory:'); // Using in-memory DB for demonstration

db.serialize(() => {
    db.run(`CREATE TABLE products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        description TEXT
    )`);

    const stmt = db.prepare("INSERT INTO products (name, price, description) VALUES (?, ?, ?)");
    const products = [
        ['Wireless Headphones', 59.99, 'High-quality noise cancelling headphones'],
        ['Smartphone Case', 15.00, 'Durable protective case for smartphones'],
        ['Bluetooth Speaker', 45.50, 'Portable speaker with excellent bass'],
        ['Laptop Stand', 25.00, 'Adjustable aluminum laptop stand'],
        ['USB-C Cable', 9.99, 'Fast charging USB-C cable, 6ft length'],
        ['Mechanical Keyboard', 89.99, 'RGB mechanical keyboard with blue switches']
    ];

    const insertStmt = db.prepare("INSERT INTO products (name, price, description) VALUES (?, ?, ?)");
    const insertMany = db.prepare("INSERT INTO products (name, price, description) VALUES (@name, @price, @desc)");
    
    // Use a transaction for faster insertion
    db.run("BEGIN TRANSACTION");
    products.forEach(p => {
        db.run("INSERT INTO products (name, price, description) VALUES (?, ?, ?)", p);
    });
    db.run("COMMIT", function(err) {
        if (err) {
            console.error("Error inserting sample data:", err.message);
        } else {
            console.log("Sample data inserted successfully.");
        }
    });
});

// Search route
app.get('/api/products/search', (req, res) => {
    const keyword = req.query.keyword;

    if (!keyword || typeof keyword !== 'string') {
        return res.status(400).json({ error: 'Keyword query parameter is required and must be a string.' });
    }

    // Use parameterized query to prevent SQL injection
    // The LIKE operator with wildcards allows partial matching
    const sql = `SELECT id, name, price, description FROM products WHERE name LIKE ? OR description LIKE ?`;
    const searchPattern = `%${keyword}%`;

    db.all(sql, [searchPattern, searchPattern], (err, rows) => {
        if (err) {
            console.error("Database error:", err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        
        // Return the results as JSON
        res.json(rows);
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Closed the database connection.');
        process.exit(0);
    });
});