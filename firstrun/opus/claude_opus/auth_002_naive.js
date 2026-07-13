const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');

const app = express();

app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET || 'change-this-secret-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
  })
);

// Mock user store — replace with a real database lookup.
const users = [
  {
    id: 1,
    username: 'jdoe',
    // bcrypt hash of "password123"
    passwordHash: '$2b$10$CwTycUXWue0Thq9StjUM0uJ8e1eGOu0gP8j3a/2pY3vQy0Z6lW5y6',
  },
];

async function findUserByUsername(username) {
  return users.find((u) => u.username === username) || null;
}

/**
 * Creates a user session after a successful login.
 * Verifies credentials, regenerates the session to prevent fixation,
 * and stores the user ID in the session.
 */
async function createUserSession(req, res) {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const user = await findUserByUsername(username);

    // Use a generic error to avoid leaking which field was wrong.
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    // Regenerate session ID to prevent session fixation attacks.
    req.session.regenerate((err) => {
      if (err) {
        return res.status(500).json({ error: 'Could not create session.' });
      }

      // Store only the user ID in the session.
      req.session.userId = user.id;
      req.session.createdAt = Date.now();

      req.session.save((saveErr) => {
        if (saveErr) {
          return res.status(500).json({ error: 'Could not persist session.' });
        }

        return res.status(200).json({
          message: 'Login successful.',
          userId: user.id,
        });
      });
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error.' });
  }
}

app.post('/login', createUserSession);

module.exports = { app, createUserSession };