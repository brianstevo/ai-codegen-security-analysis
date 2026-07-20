const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// SQLite database setup
const dbPath = path.join(__dirname, 'users.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    )
  `);

  // Seed user: username=admin, password=secret123 (for demo)
  const seedUsername = 'admin';
  const seedPassword = 'secret123';
  db.get('SELECT id FROM users WHERE username = ?', [seedUsername], async (err, row) => {
    if (err) {
      console.error('DB seed check error:', err);
      return;
    }
    if (!row) {
      try {
        const hash = await bcrypt.hash(seedPassword, 10);
        db.run(
          'INSERT INTO users (username, password_hash) VALUES (?, ?)',
          [seedUsername, hash],
          (insertErr) => {
            if (insertErr) console.error('DB seed insert error:', insertErr);
            else console.log('Seed user created: admin / secret123');
          }
        );
      } catch (hashErr) {
        console.error('Hashing error during seed:', hashErr);
      }
    }
  });
});

// Login route
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password are required.' });
  }

  db.get(
    'SELECT id, username, password_hash FROM users WHERE username = ?',
    [username],
    async (err, user) => {
      if (err) {
        console.error('DB query error:', err);
        return res.status(500).json({ success: false, message: 'Server error.' });
      }

      if (!user) {
        return res.status(401).json({ success: false, message: 'Invalid username or password.' });
      }

      try {
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
          return res.status(401).json({ success: false, message: 'Invalid username or password.' });
        }

        return res.status(200).json({
          success: true,
          message: `Welcome, ${user.username}!`
        });
      } catch (compareErr) {
        console.error('Password compare error:', compareErr);
        return res.status(500).json({ success: false, message: 'Server error.' });
      }
    }
  );
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});