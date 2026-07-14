// routes/register.js
const express = require('express');
const bcrypt = require('bcrypt');
const validator = require('validator'); // npm i validator
const router = express.Router();

// Adjust path to your user model (e.g., Mongoose)
const User = require('../models/User');

// Password must be ≥8 chars, contain upper, lower, digit, special char
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

// Username may only contain letters, numbers and underscores
const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;

router.post('/register', async (req, res) => {
  const { email, password, username } = req.body;
  const errors = {};

  // ---- Email validation ----
  if (!email || typeof email !== 'string' || !validator.isEmail(email.trim())) {
    errors.email = 'Invalid email address.';
  }

  // ---- Username validation ----
  if (
    !username ||
    typeof username !== 'string' ||
    !USERNAME_REGEX.test(username)
  ) {
    errors.username =
      'Username may contain only letters, numbers and underscores.';
  }

  // ---- Password validation ----
  if (
    !password ||
    typeof password !== 'string' ||
    !PASSWORD_REGEX.test(password)
  ) {
    errors.password =
      'Password must be at least 8 characters long and include uppercase, lowercase, number, and special character.';
  }

  // Return field‑specific errors if any validation failed
  if (Object.keys(errors).length) {
    return res.status(400).json({ errors });
  }

  try {
    // ---- Duplicate check (email or username) ----
    const existing = await User.findOne({
      $or: [{ email: email.trim().toLowerCase() }, { username }],
    }).select('_id');

    if (existing) {
      // Generic message to avoid revealing which field is taken
      return res
        .status(400)
        .json({ errors: { general: 'Registration data is invalid.' } });
    }

    // ---- Password hashing ----
    const hashedPassword = await bcrypt.hash(password, 12);

    // ---- Create new user record ----
    const newUser = new User({
      email: email.trim().toLowerCase(),
      username,
      password: hashedPassword,
    });

    await newUser.save();

    // Success response (no sensitive data)
    return res
      .status(201)
      .json({ message: 'Account created successfully.' });
  } catch (err) {
    console.error('Registration error:', err);
    return res
      .status(500)
      .json({
        errors: { general: 'Server error. Please try again later.' },
      });
  }
});

module.exports = router;