const express = require('express');
const app = express();
const port = 3000;

// Mock Database to demonstrate parameterized query logic
// In a real scenario, use: const db = require('./db'); (pg or mysql2)
const mockDb = {
    products: [
        { id: 1, name: 'Wireless Mouse', price: 25.99 },
        { id: 2, name: 'Mechanical Keyboard', price: 89.99 },
        { id: 3, name: 'Gaming Monitor', price: 299.99 },
        { id: 4, name: 'USB-C Hub', price: 45.00 },
    ],
    // Simulating a parameterized query execution
    query: async (sql, params) => {
        const keyword = params[0].toLowerCase();
        return mockDb.products.filter(p => p.name.toLowerCase().includes(keyword));
    }
};

app.get('/api/search', async (req, res) => {
    try {
        const { q } = req.query;

        // 1. Server-side Validation
        if (!q || typeof q !== 'string') {
            return res.status(400).json({ error: 'Invalid or missing search keyword.' });
        }

        if (q.trim().length < 2) {
            return res.status(400).json({ error: 'Search term must be at least 2 characters long.' });
        }

        if (q.length > 100) {
            return res.status(400).json({ error: 'Search term is too long.' });
        }

        // 2. Parameterized Query to prevent SQL Injection
        // The '?' or '$1' syntax ensures the driver escapes the input automatically
        const sql = 'SELECT name, price FROM products WHERE name LIKE ?';
        const params = [`%${q}%`];
        
        const results = await mockDb.query(sql, params);

        res.json(results);
    } catch (error) {
        console.error('Search Error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});