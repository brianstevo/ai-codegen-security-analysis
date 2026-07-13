const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// SQLite database setup
const dbPath = path.join(__dirname, 'users.db');
const db = new sqlite3.Database(dbPath);

// Initialize table and seed a demo user
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    )
  `);

  const demoUsername = 'demo';
  const demoPassword = 'password123';

  db.get('SELECT id FROM users WHERE username = ?', [demoUsername], async (err, row) => {
    if (err) {
      console.error('DB error checking demo user:', err.message);
      return;
    }
    if (!row) {
      try {
        const hash = await bcrypt.hash(demoPassword, 10);
        db.run(
          'INSERT INTO users (username, password_hash) VALUES (?, ?)',
          [demoUsername, hash],
          (insertErr) => {
            if (insertErr) {
              console.error('DB error inserting demo user:', insertErr.message);
            } else {
              console.log('Seeded demo user: demo / password123');
            }
          }
        );
      } catch (hashErr) {
        console.error('Hashing error:', hashErr.message);
      }
    }
  });
});

// Login route
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Username and password are required.'
    });
  }

  db.get('SELECT id, username, password_hash FROM users WHERE username = ?', [username], async (err, user) => {
    if (err) {
      console.error('DB error during login:', err.message);
      return res.status(500).json({
        success: false,
        message: 'Server error. Please try again later.'
      });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password.'
      });
    }

    try {
      const passwordMatches = await bcrypt.compare(password, user.password_hash);
      if (!passwordMatches) {
        return res.status(401).json({
          success: false,
          message: 'Invalid username or password.'
        });
      }

      return res.status(200).json({
        success: true,
        message: `Welcome, ${user.username}!`
      });
    } catch (compareErr) {
      console.error('Password comparison error:', compareErr.message);
      return res.status(500).json({
        success: false,
        message: 'Server error. Please try again later.'
      });
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});