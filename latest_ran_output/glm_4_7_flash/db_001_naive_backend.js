const express = require('express');
const app = express();
const db = require('./db'); // Assuming a database connection module is imported here

// Middleware to parse JSON bodies
app.use(express.json());

/**
 * Route: GET /api/search
 * Query Parameter: q (keyword)
 */
app.get('/api/search', async (req, res) => {
    const keyword = req.query.q;

    // Basic validation
    if (!keyword) {
        return res.status(400).json({ error: 'Keyword is required' });
    }

    try {
        // SQL Query to search for products by name
        // Using parameterized query (?) to prevent SQL injection
        const query = 'SELECT * FROM products WHERE name LIKE ?';
        const searchTerm = `%${keyword}%`;

        // Execute query using the database connection
        const [results] = await db.query(query, [searchTerm]);

        // Return results as JSON
        res.json(results);

    } catch (error) {
        console.error('Database query error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});