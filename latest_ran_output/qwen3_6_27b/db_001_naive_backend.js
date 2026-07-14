const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the current directory
app.use(express.static(path.join(__dirname)));

// Initialize SQLite database
const db = new sqlite3.Database(':memory:');

// Create products table and insert sample data
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        description TEXT
    )`);

    const sampleProducts = [
        ['Laptop Pro 15', 1299.99, 'High-performance laptop with 16GB RAM'],
        ['Wireless Mouse', 29.99, 'Ergonomic wireless mouse with long battery life'],
        ['Mechanical Keyboard', 89.99, 'RGB mechanical keyboard with blue switches'],
        ['USB-C Hub', 49.99, '7-in-1 USB-C hub with HDMI and SD card reader'],
        ['Monitor Stand', 39.99, 'Adjustable monitor stand for better ergonomics'],
        ['Webcam HD', 59.99, '1080p webcam with built-in microphone'],
        ['External SSD 1TB', 109.99, 'Fast external solid state drive'],
        ['Bluetooth Speaker', 79.99, 'Portable waterproof Bluetooth speaker'],
        ['Phone Case Premium', 24.99, 'Durable phone case with screen protector'],
        ['Charging Cable Fast', 14.99, 'Fast charging USB-C cable 6ft']
    ];

    const stmt = db.prepare('INSERT INTO products (name, price, description) VALUES (?, ?, ?)');
    sampleProducts.forEach(product => {
        stmt.run(product);
    });
    stmt.finalize();
});

// Search route
app.get('/api/products/search', (req, res) => {
    const keyword = req.query.keyword;
    
    if (!keyword || typeof keyword !== 'string') {
        return res.status(400).json({ error: 'Keyword parameter is required' });
    }

    // Use parameterized query to prevent SQL injection
    const searchQuery = `SELECT id, name, price, description FROM products WHERE name LIKE ? OR description LIKE ?`;
    const searchTerm = `%${keyword}%`;

    db.all(searchQuery, [searchTerm, searchTerm], (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
        
        // Return results as JSON
        res.json(rows || []);
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error(err.message);
        }
        console.log('Database connection closed');
        process.exit(0);
    });
});