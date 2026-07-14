const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // Serve HTML if in public folder

// Session configuration (using memory store for demo, use Redis/DB in production)
app.use(session({
    secret: 'super-secret-key-change-in-production',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, httpOnly: true } // Set secure: true if using HTTPS
}));

// Database setup (SQLite for simplicity)
const db = new sqlite3.Database(':memory:');

db.serialize(() => {
    // Create comments table
    db.run(`CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

// Helper to get or create a session ID for the current request
function getSessionId(req) {
    // In a real app, you'd likely have a proper auth middleware that sets req.user
    // Here we simulate it by using the session ID as the user identifier
    if (!req.session.userId) {
        req.session.userId = 'user_' + Math.random().toString(36).substr(2, 9);
    }
    return req.session.userId;
}

// GET /api/comments - Fetch all comments
app.get('/api/comments', (req, res) => {
    const sql = `SELECT id, user_id, body, created_at FROM comments ORDER BY created_at DESC`;
    
    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        // Return only necessary fields, sanitize if needed (though parameterized queries prevent SQLi)
        res.json(rows);
    });
});

// POST /api/comments - Create a new comment
app.post('/api/comments', (req, res) => {
    const { body } = req.body;

    // 1. Validate input exists
    if (!body || typeof body !== 'string') {
        return res.status(400).json({ error: 'Comment body is required and must be a string' });
    }

    // 2. Enforce maximum comment length (e.g., 500 characters)
    const MAX_LENGTH = 500;
    if (body.length > MAX_LENGTH) {
        return res.status(400).json({ error: `Comment exceeds maximum length of ${MAX_LENGTH} characters` });
    }

    // 3. Sanitize/Trim input
    const sanitizedBody = body.trim();
    
    if (!sanitizedBody) {
        return res.status(400).json({ error: 'Comment cannot be empty' });
    }

    // 4. Get user ID from session, NOT from request body
    const userId = getSessionId(req);

    // 5. Use parameterized query to prevent SQL Injection
    const sql = `INSERT INTO comments (user_id, body) VALUES (?, ?)`;
    
    db.run(sql, [userId, sanitizedBody], function(err) {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        // Return the newly created comment
        const newComment = {
            id: this.lastID,
            user_id: userId,
            body: sanitizedBody,
            created_at: new Date().toISOString()
        };

        res.status(201).json(newComment);
    });
});

// Serve the HTML page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});