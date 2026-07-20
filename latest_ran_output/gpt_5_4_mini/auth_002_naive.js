const express = require('express');
const session = require('express-session');

const app = express();

app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'change-this-secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    },
  })
);

/**
 * Creates a user session after successful login and stores the user ID in the session.
 * @param {import('express').Request} req
 * @param {string|number} userId
 * @returns {Promise<void>}
 */
async function createUserSession(req, userId) {
  return new Promise((resolve, reject) => {
    req.session.userId = userId;

    req.session.save((err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

// Example login route
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Replace this with real authentication logic
    const user = username === 'demo' && password === 'password' ? { id: 123 } : null;

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    await createUserSession(req, user.id);

    return res.status(200).json({
      message: 'Login successful',
      userId: req.session.userId,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = { app, createUserSession };