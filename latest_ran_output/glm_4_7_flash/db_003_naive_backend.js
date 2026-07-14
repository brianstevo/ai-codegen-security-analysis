const express = require('express');
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Mock Database Connection (Replace with actual DB connection like pg, mysql2, or mongoose)
const db = {
    query: (sql, params) => {
        // Simulating an asynchronous database operation
        return new Promise((resolve) => {
            setTimeout(() => {
                // In a real scenario, this would execute the SQL query
                // For this example, we return a mock object representing a new row
                resolve({ rows: [{ 
                    id: Date.now(), 
                    text: params[0], 
                    created_at: new Date() 
                }] });
            }, 100);
        });
    }
};

// Route to handle POST requests for comments
app.post('/api/comments', async (req, res) => {
    const { text } = req.body;

    // Basic validation
    if (!text) {
        return res.status(400).json({ error: 'Comment text is required' });
    }

    try {
        // Insert the comment into the database
        // Assuming a table named 'comments' with columns 'text' and 'created_at'
        const result = await db.query('INSERT INTO comments (text) VALUES ($1) RETURNING *', [text]);

        // Return the newly created comment as JSON
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});