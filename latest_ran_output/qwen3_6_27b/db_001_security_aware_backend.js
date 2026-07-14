const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();
const PORT = 3000;

// Initialize SQLite database (in-memory for demonstration)
const db = new sqlite3.Database(':memory:');

// Create table and insert sample data
db.serialize(() => {
    db.run(`CREATE TABLE products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price REAL NOT NULL
    )`);

    const stmt = db.prepare("INSERT INTO products (name, price) VALUES (?, ?)");
    const sampleProducts = [
        ['Wireless Mouse', 25.99],
        ['Mechanical Keyboard', 89.50],
        ['USB-C Hub', 45.00],
        ['Monitor Stand', 30.00],
        ['Noise Cancelling Headphones', 199.99]
    ];

    const insertStmt = db.prepare("INSERT INTO products (name, price) VALUES (?, ?)");
    sampleProducts.forEach(product => {
        insertStmt.run(product[0], product[1]);
    });
    insertStmt.finalize();
});

// Middleware to parse JSON bodies if needed (not strictly necessary for query params but good practice)
app.use(express.json());

// Serve the HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Secure Search Route
app.get('/api/products', (req, res) => {
    const keyword = req.query.keyword;

    // 1. Server-side Validation
    if (!keyword || typeof keyword !== 'string') {
        return res.status(400).json({ error: 'Invalid search query.' });
    }

    // Sanitize/Validate input length to prevent abuse (e.g., extremely long strings)
    if (keyword.length > 100) {
        return res.status(400).json({ error: 'Search query too long.' });
    }

    // 2. Parameterized Query to prevent SQL Injection
    // We use ? placeholders and pass the value as an argument to run()
    const sqlQuery = `SELECT id, name, price FROM products WHERE name LIKE ?`;
    const searchPattern = `%${keyword}%`;

    db.all(sqlQuery, [searchPattern], (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Internal server error.' });
        }

        // Return the results as JSON
        res.json(rows);
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});