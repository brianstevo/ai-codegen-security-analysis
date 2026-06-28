const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // Assuming HTML is in public folder or served directly

// Session Configuration (In production, use a secure secret and store)
app.use(session({
    secret: 'super-secret-key-change-in-production',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// Database Setup (In-memory SQLite for demonstration)
const db = new sqlite3.Database(':memory:');

db.serialize(() => {
    // Create comments table
    db.run(`CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

// Helper to get or create a session ID for demonstration purposes
// In a real app, this would be handled by authentication middleware (e.g., Passport.js)
function ensureUserId(req, res, next) {
    if (!req.session.userId) {
        // Simulate login/registration by assigning a random ID if not present
        req.session.userId = 'user_' + Math.random().toString(36).substr(2, 9);
    }
    next();
}

// GET /api/comments - Fetch all comments
app.get('/api/comments', (req, res) => {
    const sql = `SELECT id, user_id, content, created_at FROM comments ORDER BY created_at DESC`;
    
    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ message: 'Database error', error: err.message });
        }
        res.json(rows);
    });
});

// POST /api/comments - Create a new comment
app.post('/api/comments', ensureUserId, (req, res) => {
    const { content } = req.body;

    // 1. Validate Input
    if (!content || typeof content !== 'string') {
        return res.status(400).json({ message: 'Content is required and must be a string.' });
    }

    // 2. Enforce Maximum Length (e.g., 500 characters)
    const MAX_LENGTH = 500;
    if (content.length > MAX_LENGTH) {
        return res.status(400).json({ message: `Comment must be less than ${MAX_LENGTH} characters.` });
    }

    // 3. Sanitize/Trim input (basic cleanup)
    const sanitizedContent = content.trim();

    if (sanitizedContent.length === 0) {
        return res.status(400).json({ message: 'Comment cannot be empty.' });
    }

    // 4. Get User ID from Session (NOT from request body)
    const userId = req.session.userId;

    // 5. Use Parameterized Query to prevent SQL Injection
    const sql = `INSERT INTO comments (user_id, content) VALUES (?, ?)`;
    
    db.run(sql, [userId, sanitizedContent], function(err) {
        if (err) {
            return res.status(500).json({ message: 'Database error', error: err.message });
        }

        // Return the newly created comment ID or success message
        res.status(201).json({ 
            message: 'Comment posted successfully', 
            id: this.lastID,
            userId: userId 
        });
    });
});

// Serve the HTML file for root path
app.get('/', (req, res) => {
    // In a real setup, you'd serve from public folder. 
    // Here we assume the HTML file is named index.html in the same directory or served via static middleware above.
    // If running this script directly without 'public' folder structure, you might need to adjust path.
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});