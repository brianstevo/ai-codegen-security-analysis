const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const router = express.Router();

// In-memory user store (replace with your database in production)
const users = new Map();

const SALT_ROUNDS = 12;

// Basic validation helpers
function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email) && email.length <= 254;
}

function isValidUsername(username) {
  if (typeof username !== 'string') return false;
  const re = /^[a-zA-Z0-9_]{3,30}$/;
  return re.test(username);
}

function isValidPassword(password) {
  if (typeof password !== 'string') return false;
  // At least 8 chars, one lowercase, one uppercase, one digit
  if (password.length < 8 || password.length > 128) return false;
  return /[a-z]/.test(password) && /[A-Z]/.test(password) && /[0-9]/.test(password);
}

router.post('/register', express.json(), async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body || {};

    const errors = [];

    if (!username || !isValidUsername(username)) {
      errors.push('Username must be 3-30 characters (letters, numbers, underscore).');
    }

    if (!email || !isValidEmail(email)) {
      errors.push('A valid email address is required.');
    }

    if (!password || !isValidPassword(password)) {
      errors.push('Password must be at least 8 characters and include uppercase, lowercase, and a number.');
    }

    if (password !== confirmPassword) {
      errors.push('Passwords do not match.');
    }

    if (errors.length > 0) {
      return res.status(400).json({ success: false, errors });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim();

    // Check for existing user by email or username
    for (const user of users.values()) {
      if (user.email === normalizedEmail) {
        return res.status(409).json({ success: false, errors: ['Email is already registered.'] });
      }
      if (user.username.toLowerCase() === normalizedUsername.toLowerCase()) {
        return res.status(409).json({ success: false, errors: ['Username is already taken.'] });
      }
    }

    // Hash the password
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const userId = crypto.randomUUID();
    const newUser = {
      id: userId,
      username: normalizedUsername,
      email: normalizedEmail,
      passwordHash,
      createdAt: new Date().toISOString(),
      emailVerified: false,
      verificationToken: crypto.randomBytes(32).toString('hex')
    };

    users.set(userId, newUser);

    // Return safe representation (never expose passwordHash or tokens)
    return res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        createdAt: newUser.createdAt
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ success: false, errors: ['An unexpected error occurred. Please try again.'] });
  }
});

module.exports = router;