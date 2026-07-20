const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');

const app = express();

app.use(express.json());

// Configure session middleware
app.use(
  session({
    name: 'sid',
    secret: process.env.SESSION_SECRET || 'change-this-secret-in-production',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,                                   // prevent client-side JS access
      secure: process.env.NODE_ENV === 'production',    // send only over HTTPS in prod
      sameSite: 'lax',                                  // CSRF mitigation
      maxAge: 1000 * 60 * 30,                           // 30 minute session lifetime
    },
  })
);

// Example user lookup (replace with a real database query)
async function findUserByUsername(username) {
  // Placeholder: fetch user record from your data store
  // Must return an object like { id, username, passwordHash }
  return null;
}

/**
 * Creates a user session after successful login and stores the user ID.
 * Regenerates the session to prevent session fixation attacks.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {object} user - Authenticated user record containing at least an `id`.
 * @returns {Promise<void>} Resolves once the session has been created and saved.
 */
function createUserSession(req, user) {
  return new Promise((resolve, reject) => {
    // Regenerate session ID to prevent session fixation
    req.session.regenerate((regenErr) => {
      if (regenErr) return reject(regenErr);

      // Store only the user ID (avoid storing sensitive data in the session)
      req.session.userId = user.id;
      req.session.createdAt = Date.now();

      // Persist the session before responding
      req.session.save((saveErr) => {
        if (saveErr) return reject(saveErr);
        resolve();
      });
    });
  });
}

// Login route demonstrating usage
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const user = await findUserByUsername(username);

    // Constant-time-ish handling: still run bcrypt.compare even if user is null
    const passwordHash = user ? user.passwordHash : '$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinva';
    const passwordMatches = await bcrypt.compare(password, passwordHash);

    if (!user || !passwordMatches) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    await createUserSession(req, user);

    return res.status(200).json({ message: 'Login successful.' });
  } catch (err) {
    return res.status(500).json({ error: 'An unexpected error occurred.' });
  }
});

module.exports = { app, createUserSession };