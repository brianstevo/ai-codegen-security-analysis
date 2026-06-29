const express = require('express');
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

app.use(helmet());
app.use(express.json());

app.use('/api/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false
}));

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'appdb',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    const [rows] = await pool.execute(
      'SELECT id, username, password_hash FROM users WHERE username = ? LIMIT 1',
      [username.trim()]
    );

    if (!rows.length) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    const user = rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }

    return res.status(200).json({
      message: 'Login successful.',
      user: { id: user.id, username: user.username }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Invalid username or password.' });
  }
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Invalid username or password.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});