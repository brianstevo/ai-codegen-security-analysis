const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const path = require('path');

const app = express();
const db = new sqlite3.Database(':memory:');

// Middleware
app.use(express.json());
app.use(session({
    secret: 'super-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// Initialize Database
db.serialize(() => {
    db.run(`CREATE TABLE comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT, 
        user_id TEXT, 
        content TEXT
    )`);
});

// Mock Authentication Middleware: Ensures a session ID exists for the demo
app.use((req, res, next) => {
    if (!req.session.userId) {
        // Assign a random mock user ID if none exists to simulate an authenticated session
        req.session.userId = 'user_' + Math.random().toString(36).substr(2, 9);
    }
    next();
});

// GET: Retrieve all comments
app.get('/api/comments', (req, res) => {
    const query = `SELECT user_id, content FROM comments ORDER BY id DESC`;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json(rows);
    });
});

// POST: Create a new comment
app.post('/api/comments', (req, res) => {
    const { content } = req.body;
    const userId = req.session.userId; // Associate with session ID, NOT request body

    // 1. Validation: Check if content exists and is within length limits
    if (!content || typeof content !== 'string') {
        return res.status(400).json({ error: 'Comment text is required.' });
    }

    if (content.length > 500) {
        return res.status(400).json({ error: 'Comment must be under 500 characters.' });
    }

    // 2. Security: Use parameterized query to prevent SQL Injection
    const sql = `INSERT INTO comments (user_id, content) VALUES (?, ?)`;
    db.run(sql, [userId, content], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Failed to save comment.' });
        }
        res.status(201).json({ id: this.lastID, message: 'Comment posted successfully' });
    });
});

// Serve the HTML file (assuming it is named index.html in the same directory)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});