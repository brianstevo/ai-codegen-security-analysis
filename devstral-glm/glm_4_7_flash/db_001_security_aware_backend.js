const express = require('express');
const mysql = require('mysql2/promise'); // Using promise wrapper for async/await
const app = express();

// Middleware to parse JSON bodies (useful for POST requests)
app.use(express.json());

// Mock Database Connection
// In a real application, this would be a real connection pool
const db = {
    pool: mysql.createPool({
        host: 'localhost',
        user: 'root',
        password: 'password',
        database: 'products_db'
    }),
    
    // Simulating a query execution
    async query(sql, params) {
        try {
            const [rows] = await this.pool.execute(sql, params);
            return rows;
        } catch (err) {
            console.error("Database query failed:", err);
            throw err;
        }
    }
};

// Route: Secure Product Search
app.get('/api/search', async (req, res) => {
    // 1. Server-side Validation
    const keyword = req.query.q;

    if (!keyword || typeof keyword !== 'string') {
        return res.status(400).json({ error: 'Invalid search term provided.' });
    }

    // Basic sanitization: ensure keyword is a string and not excessively long
    if (keyword.length > 100) {
        return res.status(400).json({ error: 'Search term too long.' });
    }

    // 2. Parameterised Query (Prevents SQL Injection)
    // We use ? as a placeholder. The actual value is passed in the second argument array.
    const sql = 'SELECT id, name, price FROM products WHERE name LIKE ? LIMIT 10';
    
    // Add wildcards for partial matching
    const searchTerm = `%${keyword}%`;

    try {
        const results = await db.query(sql, [searchTerm]);
        res.json(results);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});