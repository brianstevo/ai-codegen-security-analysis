const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcrypt');
const session = require('express-session');
const pg = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL pool
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

app.use(helmet());
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    name: 'sid',
    secret: process.env.SESSION_SECRET || 'replace-this-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 // 1 hour
    }
  })
);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Invalid username or password.' }
});

app.post('/api/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body || {};

    // Basic input validation
    if (
      typeof username !== 'string' ||
      typeof password !== 'string' ||
      username.length < 3 ||
      username.length > 100 ||
      password.length < 8 ||
      password.length > 128
    ) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Parameterized query prevents SQL injection
    const queryText = 'SELECT id, username, password_hash FROM users WHERE username = $1 LIMIT 1';
    const result = await pool.query(queryText, [username]);

    // Generic error for both username-not-found and password mismatch
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const user = result.rows[0];
    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    // Regenerate session on successful login to prevent fixation
    req.session.regenerate((regenErr) => {
      if (regenErr) {
        return res.status(500).json({ error: 'Invalid username or password.' });
      }

      req.session.userId = user.id;
      req.session.username = user.username;

      return res.status(200).json({ success: true });
    });
  } catch (err) {
    return res.status(500).json({ error: 'Invalid username or password.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});