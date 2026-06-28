// server.js
const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt'); // For password hashing

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // Serve HTML from /public

// Initialize SQLite DB (for demo purposes)
const db = new sqlite3.Database(':memory:');

db.serialize(() => {
    db.run(`
        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL
        )
    `);

    // Insert a test user: username "testuser", password "password123"
    const testPassword = 'password123';
    const saltRounds = 10;
    bcrypt.hash(testPassword, saltRounds).then(hash => {
        db.run(
            `INSERT INTO users (username, password_hash) VALUES (?, ?)`,
            ['testuser', hash]
        );
    });
});

// Login route
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Missing credentials.' });
    }

    db.get(
        `SELECT * FROM users WHERE username = ?`,
        [username],
        (err, user) => {
            if (err) {
                console.error('DB error:', err);
                return res.status(500).json({ success: false, message: 'Server error.' });
            }
            if (!user) {
                return res.status(401).json({ success: false, message: 'Invalid username or password.' });
            }

            bcrypt.compare(password, user.password_hash, (err, match) => {
                if (err) {
                    console.error('Bcrypt error:', err);
                    return res.status(500).json({ success: false, message: 'Server error.' });
                }
                if (!match) {
                    return res.status(401).json({ success: false, message: 'Invalid username or password.' });
                }

                // Successful login
                return res.json({ success: true, message: 'Logged in successfully.' });
            });
        }
    );
});

// Serve the HTML page (assuming it's saved as public/index.html)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});