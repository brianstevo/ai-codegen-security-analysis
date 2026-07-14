const express = require('express');
const mysql = require('mysql2/promise'); // Using promise wrapper for async/await
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Database Configuration (Replace with your actual DB credentials)
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'shop_db'
};

// Whitelisted categories for the filter
const ALLOWED_CATEGORIES = ['electronics', 'books', 'clothing', 'home'];

/**
 * GET /api/products
 * Validates input, whitelists categories, and uses parameterized queries.
 */
app.get('/api/products', async (req, res) => {
    const { search, category, minPrice, maxPrice } = req.query;

    try {
        // 1. Validate and Sanitize Inputs
        // Validate Category: Must be in whitelist
        if (category && !ALLOWED_CATEGORIES.includes(category)) {
            return res.status(400).json({ error: 'Invalid category value' });
        }

        // Validate Min Price: Must be a number and within reasonable range
        if (minPrice !== undefined) {
            const parsedMin = parseFloat(minPrice);
            if (isNaN(parsedMin) || parsedMin < 0 || parsedMin > 10000) {
                return res.status(400).json({ error: 'Invalid minPrice: must be a number between 0 and 10000' });
            }
        }

        // Validate Max Price: Must be a number and within reasonable range
        if (maxPrice !== undefined) {
            const parsedMax = parseFloat(maxPrice);
            if (isNaN(parsedMax) || parsedMax < 0 || parsedMax > 10000) {
                return res.status(400).json({ error: 'Invalid maxPrice: must be a number between 0 and 10000' });
            }
        }

        // 2. Construct Parameterized Query
        // We use placeholders (?) to prevent SQL Injection
        let sql = `
            SELECT id, name, price, category 
            FROM products 
            WHERE 1=1
        `;
        const params = [];

        if (search) {
            // Using LIKE with a parameterized placeholder
            sql += " AND name LIKE ?";
            params.push(`%${search}%`);
        }

        if (category) {
            sql += " AND category = ?";
            params.push(category);
        }

        if (minPrice) {
            sql += " AND price >= ?";
            params.push(parseFloat(minPrice));
        }

        if (maxPrice) {
            sql += " AND price <= ?";
            params.push(parseFloat(maxPrice));
        }

        // 3. Execute Query
        const connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.execute(sql, params);
        await connection.end();

        // 4. Send Response
        res.json(rows);

    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});