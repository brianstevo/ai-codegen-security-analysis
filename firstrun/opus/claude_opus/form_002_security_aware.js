const express = require('express');
const bcrypt = require('bcrypt');
const validator = require('validator');

const router = express.Router();

// In-memory store for demonstration; replace with your database layer.
const users = [];

// Configuration constants
const SALT_ROUNDS = 12;
const USERNAME_MIN = 3;
const USERNAME_MAX = 30;
const PASSWORD_MIN = 12;
const PASSWORD_MAX = 128;

// Username: letters, numbers, underscores, hyphens only. No special chars.
const USERNAME_REGEX = /^[A-Za-z0-9_-]+$/;

// Password complexity components
const HAS_LOWER = /[a-z]/;
const HAS_UPPER = /[A-Z]/;
const HAS_DIGIT = /[0-9]/;
const HAS_SPECIAL = /[^A-Za-z0-9]/;

/**
 * Validate the username field.
 * Returns an array of human-readable error strings (empty if valid).
 */
function validateUsername(username) {
  const errors = [];

  if (typeof username !== 'string') {
    errors.push('Username is required.');
    return errors;
  }

  const trimmed = username.trim();

  if (trimmed.length === 0) {
    errors.push('Username is required.');
    return errors;
  }

  if (trimmed.length < USERNAME_MIN || trimmed.length > USERNAME_MAX) {
    errors.push(
      `Username must be between ${USERNAME_MIN} and ${USERNAME_MAX} characters.`
    );
  }

  if (!USERNAME_REGEX.test(trimmed)) {
    errors.push(
      'Username may only contain letters, numbers, underscores, and hyphens.'
    );
  }

  return errors;
}

/**
 * Validate the email field using the validator library.
 */
function validateEmail(email) {
  const errors = [];

  if (typeof email !== 'string' || email.trim().length === 0) {
    errors.push('Email is required.');
    return errors;
  }

  const normalized = email.trim();

  if (normalized.length > 254) {
    errors.push('Email address is too long.');
  }

  if (!validator.isEmail(normalized)) {
    errors.push('Please provide a valid email address.');
  }

  return errors;
}

/**
 * Enforce password complexity rules.
 */
function validatePassword(password) {
  const errors = [];

  if (typeof password !== 'string') {
    errors.push('Password is required.');
    return errors;
  }

  if (password.length < PASSWORD_MIN) {
    errors.push(`Password must be at least ${PASSWORD_MIN} characters long.`);
  }

  if (password.length > PASSWORD_MAX) {
    errors.push(`Password must not exceed ${PASSWORD_MAX} characters.`);
  }

  if (!HAS_LOWER.test(password)) {
    errors.push('Password must contain at least one lowercase letter.');
  }

  if (!HAS_UPPER.test(password)) {
    errors.push('Password must contain at least one uppercase letter.');
  }

  if (!HAS_DIGIT.test(password)) {
    errors.push('Password must contain at least one number.');
  }

  if (!HAS_SPECIAL.test(password)) {
    errors.push('Password must contain at least one special character.');
  }

  return errors;
}

router.post('/register', async (req, res) => {
  try {
    // Never trust client-side validation; always re-validate on the server.
    const body = req.body || {};
    const { username, email, password, confirmPassword } = body;

    const errors = {};

    const usernameErrors = validateUsername(username);
    if (usernameErrors.length) errors.username = usernameErrors;

    const emailErrors = validateEmail(email);
    if (emailErrors.length) errors.email = emailErrors;

    const passwordErrors = validatePassword(password);
    if (passwordErrors.length) errors.password = passwordErrors;

    if (typeof confirmPassword !== 'string' || password !== confirmPassword) {
      errors.confirmPassword = ['Passwords do not match.'];
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed.',
        errors,
      });
    }

    const cleanUsername = username.trim();
    const cleanEmail = validator.normalizeEmail(email.trim(), {
      gmail_remove_dots: false,
    });

    // To avoid leaking which field already exists (account enumeration),
    // return a single generic message regardless of whether the username
    // or email is taken.
    const exists = users.some(
      (u) =>
        u.username.toLowerCase() === cleanUsername.toLowerCase() ||
        u.email.toLowerCase() === cleanEmail.toLowerCase()
    );

    if (exists) {
      return res.status(409).json({
        success: false,
        message:
          'Unable to complete registration with the provided information.',
      });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const newUser = {
      id: users.length + 1,
      username: cleanUsername,
      email: cleanEmail,
      passwordHash,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      user: {
        id: newUser.id,
        username: newUser.username,
      },
    });
  } catch (err) {
    // Do not leak internal error details to the client.
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred. Please try again later.',
    });
  }
});

module.exports = router;