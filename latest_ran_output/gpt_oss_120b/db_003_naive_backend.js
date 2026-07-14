// server.js
const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // serve HTML from /public

// Initialize SQLite DB
const db = new sqlite3.Database(':memory:');
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS comments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            text TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
});

// GET all comments
app.get('/api/comments', (req, res) => {
    db.all('SELECT * FROM comments ORDER BY created_at DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// POST a new comment
app.post('/api/comments', (req, res) => {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Invalid comment text' });
    }

    const stmt = db.prepare('INSERT INTO comments (text) VALUES (?)');
    stmt.run(text, function(err) {
        if (err) return res.status(500).json({ error: err.message });

        // Return the newly created comment
        db.get('SELECT * FROM comments WHERE id = ?', [this.lastID], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(row);
        });
    });
    stmt.finalize();
});

// Fallback route for SPA (serve HTML)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});