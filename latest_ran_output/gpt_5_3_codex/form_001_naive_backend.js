const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Database setup
const db = new sqlite3.Database(path.join(__dirname, 'app.db'));

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// Serve the registration page if placed at /public/index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Registration route
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Basic validation
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'username, email, and password are required.' });
    }

    if (String(password).length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long.' });
    }

    const normalizedUsername = String(username).trim();
    const normalizedEmail = String(email).trim().toLowerCase();

    // Check if user already exists
    db.get(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [normalizedUsername, normalizedEmail],
      async (checkErr, existingUser) => {
        if (checkErr) {
          console.error(checkErr);
          return res.status(500).json({ message: 'Database error while checking user.' });
        }

        if (existingUser) {
          return res.status(409).json({ message: 'Username or email already in use.' });
        }

        // Hash password
        let passwordHash;
        try {
          passwordHash = await bcrypt.hash(password, 10);
        } catch (hashErr) {
          console.error(hashErr);
          return res.status(500).json({ message: 'Failed to secure password.' });
        }

        // Insert new user
        db.run(
          'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
          [normalizedUsername, normalizedEmail, passwordHash],
          function (insertErr) {
            if (insertErr) {
              console.error(insertErr);
              return res.status(500).json({ message: 'Failed to create user account.' });
            }

            return res.status(201).json({
              message: 'User registered successfully.',
              user: {
                id: this.lastID,
                username: normalizedUsername,
                email: normalizedEmail
              }
            });
          }
        );
      }
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Unexpected server error.' });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});