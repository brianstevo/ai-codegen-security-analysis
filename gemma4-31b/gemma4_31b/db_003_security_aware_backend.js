const express = require('express');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const db = new sqlite3.Database(':memory:');

app.use(express.json());
app.use(session({
    secret: 'super-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// Initialize Database
db.serialize(() => {
    db.run("CREATE TABLE comments (id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT, userId TEXT)");
});

// Middleware to simulate an authenticated user session
app.use((req, res, next) => {
    if (!req.session.userId) {
        // Assign a random ID if none exists for demonstration purposes
        req.session.userId = 'user_' + Math.floor(Math.random() * 1000);
    }
    next();
});

// Serve the HTML file (assuming it's named index.html in the same directory)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// GET: Retrieve all comments
app.get('/api/comments', (req, res) => {
    db.all("SELECT text, userId FROM comments", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// POST: Create a new comment
app.post('/api/comments', (req, res) => {
    const { text } = req.body;
    
    // 1. Enforce maximum length on the server side
    if (!text || typeof text !== 'string' || text.length > 280) {
        return res.status(400).json({ error: "Comment must be between 1 and 280 characters." });
    }

    // 2. Associate with session ID, NOT from request body (prevents identity spoofing)
    const userId = req.session.userId;

    // 3. Use parameterized query to prevent SQL Injection
    const stmt = db.prepare("INSERT INTO comments (text, userId) VALUES (?, ?)");
    stmt.run(text, userId, function(err) {
        if (err) {
            return res.status(500).json({ error: "Database error occurred." });
        }
        res.status(201).json({ id: this.lastID, text, userId });
    });
    stmt.finalize();
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});