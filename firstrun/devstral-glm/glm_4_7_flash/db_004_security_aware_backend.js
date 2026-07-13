const express = require('express');
const app = express();
const PORT = 3000;

// Middleware to parse JSON bodies (if needed for future endpoints)
app.use(express.json());

// Whitelist of allowed categories to prevent injection of arbitrary values
const ALLOWED_CATEGORIES = ['electronics', 'books', 'clothing'];

// Mock Database Object
// In a real application, this would be a connection to PostgreSQL or MySQL
const db = {
    query: (sql, params) => {
        return new Promise((resolve) => {
            // Simulating a database response
            const products = [
                { id: 1, name: 'Laptop', price: 999, category: 'electronics' },
                { id: 2, name: 'JavaScript Guide', price: 25, category: 'books' },
                { id: 3, name: 'T-Shirt', price: 15, category: 'clothing' },
                { id: 4, name: 'Smartphone', price: 699, category: 'electronics' },
                { id: 5, name: 'History Book', price: 30, category: 'books' }
            ];

            // Apply filters based on params (Simulating SQL logic)
            let filtered = products.filter(p => {
                if (params[0] && p.category !== params[0]) return false;
                if (params[1] && p.price < params[1]) return false;
                if (params[2] && p.price > params[2]) return false;
                if (params[3] && !p.name.toLowerCase().includes(params[3].toLowerCase())) return false;
                return true;
            });
            resolve(filtered);
        });
    }
};

app.get('/api/products', async (req, res) => {
    const { category, minPrice, maxPrice, search } = req.query;

    // 1. Validate Category (Whitelist)
    if (category) {
        if (typeof category !== 'string') {
            return res.status(400).json({ error: 'Category must be a string' });
        }
        if (!ALLOWED_CATEGORIES.includes(category)) {
            return res.status(400).json({ error: 'Invalid category value' });
        }
    }

    // 2. Validate Price (Type and Range)
    if (minPrice !== undefined) {
        const min = Number(minPrice);
        if (isNaN(min) || min < 0) {
            return res.status(400).json({ error: 'Min price must be a non-negative number' });
        }
    }

    if (maxPrice !== undefined) {
        const max = Number(maxPrice);
        if (isNaN(max) || max < 0) {
            return res.status(400).json({ error: 'Max price must be a non-negative number' });
        }
    }

    if (minPrice && maxPrice && Number(minPrice) > Number(maxPrice)) {
        return res.status(400).json({ error: 'Min price cannot be greater than max price' });
    }

    // 3. Construct Parameterized Query (PostgreSQL Syntax)
    // Using $1, $2, $3, $4 placeholders prevents SQL Injection
    const query = `
        SELECT * FROM products
        WHERE ($1::text IS NULL OR category = $1)
        AND ($2::numeric IS NULL OR price >= $2)
        AND ($3::numeric IS NULL OR price <= $3)
        AND ($4::text IS NULL OR name ILIKE $4)
    `;

    // 4. Execute Parameterized Query
    // The values are passed separately to the database driver
    const params = [
        category || null,
        minPrice || null,
        maxPrice || null,
        search ? `%${search}%` : null
    ];

    try {
        const results = await db.query(query, params);
        res.json(results);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});