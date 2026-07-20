const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const csurf = require('csurf');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

// --- Security middleware ---
app.use(helmet());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
app.use(cookieParser());

app.use(session({
  secret: process.env.SESSION_SECRET || 'replace-this-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false // set true behind HTTPS in production
  }
}));

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/register', registerLimiter);

// CSRF protection (session-based)
const csrfProtection = csurf({ cookie: false });

// --- DB setup ---
const db = new sqlite3.Database('./users.db');
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

// Helper validation functions
function isValidUsername(username) {
  return typeof username === 'string' &&
    username.length >= 3 &&
    username.length <= 30 &&
    /^[A-Za-z0-9_]+$/.test(username);
}

function isValidEmail(email) {
  if (typeof email !== 'string' || email.length > 254) return false;
  // Practical, not perfect RFC parser
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isStrongPassword(password) {
  // min 12, max 128, uppercase, lowercase, digit, symbol
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) return false;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  return hasUpper && hasLower && hasDigit && hasSymbol;
}

// CSRF token endpoint
app.get('/csrf-token', csrfProtection, (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// Registration route (server-side validation only trusted)
app.post('/register', csrfProtection, async (req, res) => {
  try {
    const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = req.body.password;
    const confirmPassword = req.body.confirmPassword;

    if (!isValidUsername(username)) {
      return res.status(400).json({ error: 'Invalid username format or length.' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email address.' });
    }
    if (!isStrongPassword(password)) {
      return res.status(400).json({
        error: 'Password must be 12-128 chars and include uppercase, lowercase, number, and symbol.'
      });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    db.get(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email],
      (selectErr, row) => {
        if (selectErr) {
          return res.status(500).json({ error: 'Server error.' });
        }
        if (row) {
          return res.status(409).json({ error: 'Username or email already in use.' });
        }

        db.run(
          'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
          [username, email, passwordHash],
          function (insertErr) {
            if (insertErr) {
              return res.status(500).json({ error: 'Could not create user.' });
            }
            return res.status(201).json({ message: 'User registered successfully.' });
          }
        );
      }
    );
  } catch (err) {
    res.status(500).json({ error: 'Unexpected server error.' });
  }
});

// CSRF error handler
app.use((err, req, res, next) => {
  if (err && err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ error: 'Invalid CSRF token.' });
  }
  next(err);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});