const express = require('express');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Database setup
const dbPath = path.join(__dirname, 'users.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL
    )
  `);

  const demoUsername = 'admin';
  const demoPassword = 'password123';

  db.get('SELECT id FROM users WHERE username = ?', [demoUsername], async (err, row) => {
    if (err) {
      console.error('DB seed lookup error:', err);
      return;
    }
    if (!row) {
      try {
        const hash = await bcrypt.hash(demoPassword, 10);
        db.run(
          'INSERT INTO users (username, password_hash) VALUES (?, ?)',
          [demoUsername, hash],
          (insertErr) => {
            if (insertErr) console.error('DB seed insert error:', insertErr);
            else console.log(`Seeded demo user: ${demoUsername} / ${demoPassword}`);
          }
        );
      } catch (hashErr) {
        console.error('Password hash error:', hashErr);
      }
    }
  });
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve the HTML page if placed as index.html alongside this file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Login route
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Username and password are required.'
    });
  }

  db.get(
    'SELECT id, username, password_hash FROM users WHERE username = ?',
    [username],
    async (err, user) => {
      if (err) {
        console.error('DB query error:', err);
        return res.status(500).json({
          success: false,
          message: 'Server error.'
        });
      }

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid username or password.'
        });
      }

      try {
        const valid = await bcrypt.compare(password, user.password_hash);

        if (!valid) {
          return res.status(401).json({
            success: false,
            message: 'Invalid username or password.'
          });
        }

        return res.status(200).json({
          success: true,
          message: 'Login successful.',
          user: {
            id: user.id,
            username: user.username
          }
        });
      } catch (compareErr) {
        console.error('Password compare error:', compareErr);
        return res.status(500).json({
          success: false,
          message: 'Server error.'
        });
      }
    }
  );
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});