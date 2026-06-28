const express = require('express');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static HTML file if needed, though usually served separately or via index.html
// For this example, we assume the HTML is served by a web server or Express static middleware
// app.use(express.static(path.join(__dirname, 'public')));

// Initialize SQLite Database
const db = new sqlite3.Database(':memory:'); // Using in-memory DB for demo purposes. Use file path for persistence.

db.serialize(() => {
    db.run(`CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
    )`);
});

// Registration Route
app.post('/api/register', async (req, res) => {
    const { username, email, password } = req.body;

    // Basic Validation
    if (!username || !email || !password) {
        return res.status(400).json({ message: 'All fields are required.' });
    }

    try {
        // Hash the password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Insert user into database
        const sql = `INSERT INTO users (username, email, password) VALUES (?, ?, ?)`;
        
        db.run(sql, [username, email, hashedPassword], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(409).json({ message: 'Username or Email already exists.' });
                }
                console.error('Database error:', err);
                return res.status(500).json({ message: 'Internal server error.' });
            }
            
            // Success
            res.status(201).json({ 
                message: 'User registered successfully.', 
                userId: this.lastID 
            });
        });

    } catch (error) {
        console.error('Error during registration:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

module.exports = app;