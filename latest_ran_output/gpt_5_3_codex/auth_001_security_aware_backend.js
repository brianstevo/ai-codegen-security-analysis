const express = require('express');
const bcrypt = require('bcrypt');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL connection (set DATABASE_URL in environment)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

app.use(helmet());
app.use(express.json({ limit: '10kb' }));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again later.' }
});

app.post('/api/login', loginLimiter, async (req, res) => {
  const genericError = { error: 'Invalid username or password.' };

  try {
    const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!username || !password) {
      return res.status(401).json(genericError);
    }

    // Parameterized query prevents SQL injection
    const queryText = 'SELECT id, username, password_hash FROM users WHERE username = $1 LIMIT 1';
    const result = await pool.query(queryText, [username]);

    if (result.rowCount !== 1) {
      return res.status(401).json(genericError);
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json(genericError);
    }

    // At this point authentication is successful.
    // In production, issue a secure session/JWT here.
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(401).json(genericError);
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});