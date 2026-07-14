const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Initialize SQLite Database
const db = new sqlite3.Database('./users.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        // Create users table if it doesn't exist
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            email TEXT UNIQUE,
            password TEXT
        )`);
    }
});

// Registration Route
app.post('/api/register', (req, res) => {
    const { username, email, password } = req.body;

    // Basic validation
    if (!username || !email || !password) {
        return res.status(400).json({ message: 'All fields are required.' });
    }

    // Insert new user into the database
    const sql = 'INSERT INTO users (username, email, password) VALUES (?, ?, ?)';
    const params = [username, email, password];

    db.run(sql, params, function (err) {
        if (err) {
            // Handle unique constraint violation (e.g., duplicate email)
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(409).json({ message: 'Username or email already exists.' });
            }
            return res.status(500).json({ message: 'Database error.' });
        }
        res.json({ message: 'User registered successfully.' });
    });
});

// Start the server (optional for this snippet)
// app.listen(3000, () => console.log('Server running on port 3000'));