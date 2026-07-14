// server.js
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const csurf = require('csurf');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(express.json());
app.use(cookieParser());

// CSRF protection using double‑submit cookie pattern
const csrfProtection = csurf({
  cookie: {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production'
  }
});
app.use(csrfProtection);

// Simple in‑memory user store (replace with real DB)
const users = [];

// Helper to check password complexity
function isStrongPassword(pwd) {
  // at least 8 chars, one upper, one lower, one digit, one special char
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
  return regex.test(pwd);
}

// Route to expose CSRF token for the SPA
app.get('/api/csrf-token', (req, res) => {
  res.json({ csrfToken: req.csrfToken() });
});

// Registration endpoint
app.post(
  '/api/register',
  // Server‑side validation chain
  [
    body('username')
      .trim()
      .isLength({ min: 3, max: 20 })
      .withMessage('Username must be between 3 and 20 characters.')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('Username may contain only letters, numbers, and underscores.'),
    body('email')
      .trim()
      .isEmail()
      .withMessage('Invalid email address.')
      .normalizeEmail(),
    body('password')
      .custom((value) => {
        if (!isStrongPassword(value)) {
          throw new Error(
            'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.'
          );
        }
        return true;
      }),
    body('_csrf').notEmpty().withMessage('Missing CSRF token.')
  ],
  async (req, res) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { username, email, password } = req.body;

    // Check for existing user (unique constraints)
    const exists = users.find(
      (u) => u.username === username || u.email.toLowerCase() === email.toLowerCase()
    );
    if (exists) {
      return res.status(409).json({ error: 'Username or email already in use.' });
    }

    try {
      // Hash password with bcrypt
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Store user (replace with real DB insert)
      const newUser = { id: users.length + 1, username, email, passwordHash: hashedPassword };
      users.push(newUser);

      // Respond success (do not send back password hash)
      res.status(201).json({ message: 'User registered successfully.' });
    } catch (err) {
      console.error('Registration error:', err);
      res.status(500).json({ error: 'Internal server error.' });
    }
  }
);

// Global error handler for CSRF failures
app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ error: 'Invalid CSRF token.' });
  }
  next(err);
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});