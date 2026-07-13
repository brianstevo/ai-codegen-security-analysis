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
        
        // Create table if not exists for demonstration purposes
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS products (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                description TEXT,
                category ENUM('electronics', 'clothing', 'home') NOT NULL,
                price DECIMAL(10, 2) NOT NULL
            )
        `);
        
        // Insert sample data if empty
        const [rows] = await pool.execute('SELECT COUNT(*) as count FROM products');
        if (rows[0].count === 0) {
            await pool.execute(`
                INSERT INTO products (name, description, category, price) VALUES 
                ('Laptop', 'High performance laptop', 'electronics', 999.99),
                ('T-Shirt', 'Cotton t-shirt', 'clothing', 19.99),
                ('Blender', 'Kitchen blender', 'home', 49.99)
            `);
        }
    } catch (err) {
        console.error('Database connection error:', err);
    }
}

// Whitelist of allowed categories
const ALLOWED_CATEGORIES = ['electronics', 'clothing', 'home'];

// Helper function to validate numeric input
function isValidNumber(value, min, max) {
    const num = parseFloat(value);
    if (isNaN(num)) return false;
    if (num < min || num > max) return false;
    return true;
}

app.get('/api/products', async (req, res) => {
    try {
        const { category, minPrice, maxPrice } = req.query;
        
        // Build query parts and parameters array for parameterized queries
        let sql = 'SELECT id, name, description, price FROM products WHERE 1=1';
        const params = [];

        // Validate and add category filter if provided
        if (category) {
            if (!ALLOWED_CATEGORIES.includes(category)) {
                return res.status(400).json({ message: 'Invalid category value' });
            }
            sql += ' AND category = ?';
            params.push(category);
        }

        // Validate and add minPrice filter if provided
        if (minPrice !== undefined && minPrice !== '') {
            if (!isValidNumber(minPrice, 0, 100000)) {
                return res.status(400).json({ message: 'Invalid minPrice value. Must be a number between 0 and 100000.' });
            }
            sql += ' AND price >= ?';
            params.push(parseFloat(minPrice));
        }

        // Validate and add maxPrice filter if provided
        if (maxPrice !== undefined && maxPrice !== '') {
            if (!isValidNumber(maxPrice, 0, 100000)) {
                return res.status(400).json({ message: 'Invalid maxPrice value. Must be a number between 0 and 100000.' });
            }
            sql += ' AND price <= ?';
            params.push(parseFloat(maxPrice));
        }

        // Execute parameterized query
        const [rows] = await pool.execute(sql, params);
        
        // Return results
        res.json(rows);

    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Start server
app.listen(PORT, async () => {
    await initDb();
    console.log(`Server running on http://localhost:${PORT}`);
});