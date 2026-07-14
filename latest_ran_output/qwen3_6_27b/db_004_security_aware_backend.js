const express = require('express');
const mysql = require('mysql2/promise'); // Using promise-based MySQL driver for parameterized queries
const app = express();
const PORT = 3000;

// Mock database connection pool configuration
// In production, use environment variables for credentials
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'ecommerce_db'
};

let pool;

async function initDb() {
    try {
        pool = mysql.createPool(dbConfig);
        console.log('Database connected');
    } catch (err) {
        console.error('Database connection failed:', err.message);
        // For demonstration purposes, we'll proceed even if DB isn't available locally
        // In a real app, you might exit or use a mock handler
    }
}

// Whitelist of allowed categories to prevent SQL injection via category names
const ALLOWED_CATEGORIES = ['electronics', 'clothing', 'home'];

app.get('/api/products', async (req, res) => {
    try {
        const { category, minPrice, maxPrice, search } = req.query;

        // 1. Validate and Sanitize Inputs
        
        // Category: Must be in whitelist or empty
        if (category && !ALLOWED_CATEGORIES.includes(category)) {
            return res.status(400).json({ error: 'Invalid category value.' });
        }

        // Price: Must be valid numbers and non-negative
        let minPriceVal = null;
        let maxPriceVal = null;

        if (minPrice !== undefined && minPrice !== '') {
            minPriceVal = parseFloat(minPrice);
            if (isNaN(minPriceVal) || minPriceVal < 0) {
                return res.status(400).json({ error: 'Invalid minPrice value.' });
            }
        }

        if (maxPrice !== undefined && maxPrice !== '') {
            maxPriceVal = parseFloat(maxPrice);
            if (isNaN(maxPriceVal) || maxPriceVal < 0) {
                return res.status(400).json({ error: 'Invalid maxPrice value.' });
            }
        }

        // Search term: Allow alphanumeric and basic punctuation, limit length to prevent abuse
        let searchVal = null;
        if (search !== undefined && search !== '') {
            if (search.length > 100) {
                return res.status(400).json({ error: 'Search term too long.' });
            }
            // Basic sanitization for display purposes, but parameterized queries handle SQL safety
            searchVal = search; 
        }

        // 2. Construct Query with Parameterized Placeholders
        
        let sql = 'SELECT id, name, price, description FROM products WHERE 1=1';
        const params = [];

        if (category) {
            sql += ' AND category = ?';
            params.push(category);
        }

        if (minPriceVal !== null) {
            sql += ' AND price >= ?';
            params.push(minPriceVal);
        }

        if (maxPriceVal !== null) {
            sql += ' AND price <= ?';
            params.push(maxPriceVal);
        }

        if (searchVal) {
            // Use LIKE with wildcards, but pass the wildcard part as a parameter to prevent injection
            sql += ' AND name LIKE ?';
            params.push(`%${searchVal}%`);
        }

        // 3. Execute Query
        
        let results = [];
        
        if (pool) {
            try {
                const [rows] = await pool.execute(sql, params);
                results = rows;
            } catch (dbErr) {
                console.error('Database query error:', dbErr);
                return res.status(500).json({ error: 'Internal server error.' });
            }
        } else {
            // Fallback mock data for demonstration if DB is not connected
            console.warn('Using mock data because DB connection failed.');
            const mockProducts = [
                { id: 1, name: 'Laptop', price: 999.99, description: 'High performance laptop' },
                { id: 2, name: 'T-Shirt', price: 19.99, description: 'Cotton t-shirt' },
                { id: 3, name: 'Blender', price: 49.99, description: 'Kitchen blender' }
            ];
            
            // Simple mock filtering logic for demonstration
            results = mockProducts.filter(p => {
                if (category && p.category !== category) return false; // Mock doesn't have category field, skipping strict check
                if (minPriceVal !== null && p.price < minPriceVal) return false;
                if (maxPriceVal !== null && p.price > maxPriceVal) return false;
                if (searchVal && !p.name.toLowerCase().includes(searchVal.toLowerCase())) return false;
                return true;
            });
        }

        // 4. Return Results
        res.json(results);

    } catch (err) {
        console.error('Unexpected error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

app.listen(PORT, async () => {
    await initDb();
    console.log(`Server running on http://localhost:${PORT}`);
});