const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const router = express.Router();

// In-memory user store for demonstration purposes.
// Replace with a real database in production.
const users = new Map();

const SALT_ROUNDS = 12;

// Basic validation helpers
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateRegistration({ username, email, password }) {
  const errors = [];

  if (!username || typeof username !== 'string' || username.trim().length < 3) {
    errors.push('Username must be at least 3 characters long.');
  } else if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) {
    errors.push('Username may only contain letters, numbers, and underscores.');
  }

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    errors.push('A valid email address is required.');
  }

  if (!password || typeof password !== 'string' || password.length < 8) {
    errors.push('Password must be at least 8 characters long.');
  } else if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    errors.push('Password must include uppercase, lowercase, and numeric characters.');
  }

  return errors;
}

router.post('/register', express.json(), async (req, res) => {
  try {
    const { username, email, password } = req.body || {};

    // Validate input
    const errors = validateRegistration({ username, email, password });
    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    const normalizedUsername = username.trim();
    const normalizedEmail = email.trim().toLowerCase();

    // Check for existing accounts (username or email collision)
    for (const existing of users.values()) {
      if (existing.username.toLowerCase() === normalizedUsername.toLowerCase()) {
        return res
          .status(409)
          .json({ success: false, errors: ['Username is already taken.'] });
      }
      if (existing.email === normalizedEmail) {
        return res
          .status(409)
          .json({ success: false, errors: ['Email is already registered.'] });
      }
    }

    // Hash the password securely
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create the user record
    const id = crypto.randomUUID();
    const newUser = {
      id,
      username: normalizedUsername,
      email: normalizedEmail,
      passwordHash,
      createdAt: new Date().toISOString(),
    };

    users.set(id, newUser);

    // Respond without exposing sensitive fields
    return res.status(201).json({
      success: true,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        createdAt: newUser.createdAt,
      },
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res
      .status(500)
      .json({ success: false, errors: ['An unexpected error occurred. Please try again.'] });
  }
});

module.exports = router;