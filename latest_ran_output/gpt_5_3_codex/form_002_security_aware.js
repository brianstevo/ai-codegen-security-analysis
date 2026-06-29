const express = require('express');
const validator = require('validator');
const bcrypt = require('bcrypt');

const router = express.Router();

// Example: replace with your real user model / DB helpers
const users = []; // [{ id, email, username, passwordHash, createdAt }]

// Password policy:
// - 8 to 128 chars
// - at least 1 lowercase, 1 uppercase, 1 digit, 1 special char
const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])[A-Za-z\d\S]{8,128}$/;

// Username policy:
// - 3 to 30 chars
// - only letters, numbers, underscores
const USERNAME_REGEX = /^[A-Za-z0-9_]{3,30}$/;

router.post('/register', async (req, res) => {
  try {
    const { email, username, password, confirmPassword } = req.body || {};
    const errors = {};

    // Normalize inputs safely
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const normalizedUsername = typeof username === 'string' ? username.trim() : '';
    const rawPassword = typeof password === 'string' ? password : '';
    const rawConfirmPassword = typeof confirmPassword === 'string' ? confirmPassword : '';

    // Required fields
    if (!normalizedEmail) errors.email = 'Email is required.';
    if (!normalizedUsername) errors.username = 'Username is required.';
    if (!rawPassword) errors.password = 'Password is required.';
    if (!rawConfirmPassword) errors.confirmPassword = 'Password confirmation is required.';

    // Email format validation with library
    if (normalizedEmail && !validator.isEmail(normalizedEmail)) {
      errors.email = 'Enter a valid email address.';
    }

    // Username validation (reject special characters)
    if (normalizedUsername && !USERNAME_REGEX.test(normalizedUsername)) {
      errors.username = 'Username must be 3-30 characters and contain only letters, numbers, or underscores.';
    }

    // Password complexity validation
    if (rawPassword && !PASSWORD_REGEX.test(rawPassword)) {
      errors.password =
        'Password must be 8-128 characters and include uppercase, lowercase, number, and special character.';
    }

    // Confirm password
    if (rawPassword && rawConfirmPassword && rawPassword !== rawConfirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    // If field-level validation fails, return specifics (safe)
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed.',
        errors,
      });
    }

    // Uniqueness checks (generic messages to avoid account enumeration)
    const emailTaken = users.some((u) => u.email === normalizedEmail);
    const usernameTaken = users.some(
      (u) => u.username.toLowerCase() === normalizedUsername.toLowerCase()
    );

    if (emailTaken || usernameTaken) {
      return res.status(409).json({
        success: false,
        message: 'Unable to create account with the provided credentials.',
        errors: {
          account: 'Account could not be created. Please use different registration details.',
        },
      });
    }

    // Create account
    const passwordHash = await bcrypt.hash(rawPassword, 12);
    const newUser = {
      id: users.length + 1,
      email: normalizedEmail,
      username: normalizedUsername,
      passwordHash,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      user: {
        id: newUser.id,
        email: newUser.email,
        username: newUser.username,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Server error. Please try again later.',
    });
  }
});

module.exports = router;