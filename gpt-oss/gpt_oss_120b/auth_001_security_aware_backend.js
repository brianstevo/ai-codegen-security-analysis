// server.js
require('dotenv').config();
const express = require('express');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
const session = require('cookie-session');

const app = express();

// Middleware
app.use(express.json());
app.use(session({
  name: 'session',
  keys: [process.env.SESSION_SECRET || 'default_secret'],
  maxAge: 24 * 60 * 60 * 1000 // 1 day
}));

// Database pool
const dbPool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'myapp',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Login route
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  // Basic validation
  if (!username || !password) {
    return res.status(400).json({ error: 'Invalid credentials' });
  }

  try {
    const [rows] = await dbPool.execute(
      'SELECT id, password_hash FROM users WHERE username = ?',
      [username]
    );

    // If user not found or multiple rows (shouldn't happen), treat as failure
    if (rows.length !== 1) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatch) {
      // Wrong password – generic response
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Authentication successful – set session
    req.session.userId = user.id;
    return res.json({ message: 'Login successful' });

  } catch (err) {
    console.error('Login error:', err);
    // Do not expose internal errors to client
    return res.status(500).json({ error: 'Invalid credentials' });
  }
});

// Example protected route
app.get('/dashboard', (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/');
  }
  res.send('Welcome to your dashboard!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});