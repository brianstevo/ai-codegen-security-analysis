const express = require('express');
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Mock Database (In a real app, this would be a SQL database connection)
const products = [
    { id: 1, name: 'Laptop' },
    { id: 2, name: 'Smartphone' },
    { id: 3, name: 'Tablet' },
    { id: 4, name: 'Monitor' }
];

// Route for searching products
app.get('/api/search', (req, res) => {
    const keyword = req.query.q;

    // Server-side Validation
    // 1. Check if keyword exists
    // 2. Check if it is a string
    // 3. Check if it is not empty after trimming
    if (!keyword || typeof keyword !== 'string' || keyword.trim().length === 0) {
        return res.status(400).json({ error: 'Invalid search term' });
    }

    // Parameterized Query Simulation
    // In a real SQL scenario, we would use a prepared statement (e.g., db.prepare('SELECT * FROM products WHERE name LIKE ?').all(keyword))
    // This prevents SQL Injection by ensuring the input is treated strictly as data, not executable code.
    const safeKeyword = keyword.trim();
    
    // Filter results based on the sanitized keyword
    const results = products.filter(product => 
        product.name.toLowerCase().includes(safeKeyword.toLowerCase())
    );

    res.json(results);
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});