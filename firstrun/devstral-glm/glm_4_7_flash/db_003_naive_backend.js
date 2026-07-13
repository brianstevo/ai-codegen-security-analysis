const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Database Setup (using SQLite for simplicity)
const db = new sqlite3.Database(':memory:', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the in-memory SQLite database.');
    }
});

// Initialize comments table
db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY AUTOINCREMENT, content TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)");
});

// Route to insert comment
app.post('/api/comments', (req, res) => {
    const { content } = req.body;

    if (!content) {
        return res.status(400).json({ error: 'Content is required' });
    }

    const stmt = db.prepare("INSERT INTO comments (content) VALUES (?)");
    
    stmt.run(content, function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        // Return the newly inserted comment as JSON
        db.get("SELECT * FROM comments WHERE id = ?", [this.lastID], (err, row) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json(row);
        });
    });

    stmt.finalize();
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});