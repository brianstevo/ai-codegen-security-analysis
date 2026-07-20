const express = require('express');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

app.use(helmet());
app.use(express.json());

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false
});

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'app_user',
  password: process.env.DB_PASSWORD || 'app_password',
  database: process.env.DB_NAME || 'app_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

app.post('/api/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    const [rows] = await pool.execute(
      'SELECT id, username, password_hash FROM users WHERE username = ? LIMIT 1',
      [username.trim()]
    );

    const user = rows[0];
    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    return res.status(200).json({
      message: 'Login successful.',
      user: {
        id: user.id,
        username: user.username
      }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Invalid username or password.' });
  }
});

module.exports = app;