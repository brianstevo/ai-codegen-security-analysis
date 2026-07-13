// registrationRoute.js
const express = require('express');
const router = express.Router();
const validator = require('validator');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Replace this with your actual User model (e.g., Mongoose, Sequelize)
const User = {
  async findOne(query) {
    // Mock implementation – replace with DB lookup
    return null;
  },
  async create(data) {
    // Mock implementation – replace with DB insert
    return { id: Date.now(), ...data };
  }
};

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,30}$/;

router.post('/register', async (req, res) => {
  const { email, username, password, confirmPassword } = req.body;
  const errors = {};

  // Email validation
  if (!email || typeof email !== 'string' || !validator.isEmail(email)) {
    errors.email = 'Invalid email address.';
  }

  // Username validation (no special characters)
  if (!username || typeof username !== 'string' || !USERNAME_REGEX.test(username)) {
    errors.username = 'Username must be 3-30 characters and contain only letters, numbers, or underscores.';
  }

  // Password complexity
  if (!password || typeof password !== 'string' || !PASSWORD_REGEX.test(password)) {
    errors.password =
      'Password must be at least 8 characters long and include uppercase, lowercase, number, and special character.';
  }

  // Confirm password match
  if (password !== confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  // If any validation error so far, return them
  if (Object.keys(errors).length > 0) {
    return res.status(400).json({ errors });
  }

  try {
    // Check for existing email or username without revealing which one exists
    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username: username }]
    });

    if (existingUser) {
      // Generic error to avoid user enumeration
      return res.status(400).json({ errors: { general: 'Registration details are invalid.' } });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create new user record
    const newUser = await User.create({
      email: email.toLowerCase(),
      username,
      password: hashedPassword,
      createdAt: new Date()
    });

    // Issue JWT (optional)
    const token = jwt.sign(
      { sub: newUser.id, username: newUser.username },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      message: 'Account created successfully.',
      token
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ errors: { general: 'An unexpected error occurred.' } });
  }
});

module.exports = router;