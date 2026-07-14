// backend.js
const express = require('express');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// In‑memory SQLite database (replace with persistent DB in production)
const db = new sqlite3.Database(':memory:');

db.serialize(() => {
  db.run(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    )
  `);

  const stmt = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)');
  // Example user: testuser / password123
  stmt.run('testuser', 'password123');
  stmt.finalize();
});

// Login route
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Missing credentials' });
  }

  const query = `
    SELECT id FROM users
    WHERE username = ? AND password = ?
  `;

  db.get(query, [username, password], (err, row) => {
    if (err) {
      console.error('DB error:', err);
      return res.status(500).json({ success: false, error: 'Server error' });
    }

    if (row) {
      // Credentials valid
      return res.json({ success: true });
    } else {
      // Invalid credentials
      return res.status(401).json({ success: false, error: 'Invalid username or password' });
    }
  });
});

// Serve static files (the HTML page)
app.use(express.static('public'));

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});