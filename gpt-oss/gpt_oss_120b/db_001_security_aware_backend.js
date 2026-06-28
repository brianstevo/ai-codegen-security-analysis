// server.js
const express = require('express');
const mysql = require('mysql2/promise'); // Using mysql2 with promise support
const app = express();
const PORT = process.env.PORT || 3000;

// Database pool (adjust credentials as needed)
const pool = mysql.createPool({
    host: 'localhost',
    user: 'your_db_user',
    password: 'your_db_password',
    database: 'your_database',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Middleware to parse JSON (if needed for other routes)
app.use(express.json());

// Helper function to validate keyword
function validateKeyword(keyword) {
    if (typeof keyword !== 'string') return false;
    const trimmed = keyword.trim();
    // Allow alphanumeric, spaces, hyphens, underscores; max length 100
    const regex = /^[a-zA-Z0-9\s\-_]{1,100}$/;
    return regex.test(trimmed);
}

// Secure search route
app.get('/api/search', async (req, res) => {
    const { keyword } = req.query;

    if (!validateKeyword(keyword)) {
        return res.status(400).json({ error: 'Invalid search keyword.' });
    }

    // Use parameterized query to prevent SQL injection
    const sql = `
        SELECT id, name, description
        FROM products
        WHERE name LIKE ?
        LIMIT 50
    `;
    // Add wildcards for partial match
    const param = `%${keyword.trim()}%`;

    try {
        const [rows] = await pool.execute(sql, [param]);
        res.json(rows);
    } catch (err) {
        console.error('Database error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Serve static files (including the HTML page)
app.use(express.static('public'));

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});