const express = require('express');
const bcrypt = require('bcrypt');
const validator = require('validator');

const router = express.Router();

// In-memory example store; replace with your database layer.
const users = [];

// Basic helpers
function normalizeEmail(email) {
  return validator.normalizeEmail(String(email || '').trim(), {
    gmail_remove_dots: false,
    gmail_remove_subaddress: false,
    outlookdotcom_remove_subaddress: false,
    yahoo_remove_subaddress: false,
    icloud_remove_subaddress: false,
  });
}

function isStrongPassword(password) {
  // Complexity rules:
  // - at least 12 chars
  // - at least 1 lowercase
  // - at least 1 uppercase
  // - at least 1 number
  // - at least 1 special character
  // - no spaces
  if (typeof password !== 'string') return false;
  if (password.length < 12) return false;
  if (/\s/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/\d/.test(password)) return false;
  if (!/[^A-Za-z0-9]/.test(password)) return false;
  return true;
}

function isValidUsername(username) {
  // Allow only letters, numbers, underscore; 3-30 chars.
  return typeof username === 'string' && /^[A-Za-z0-9_]{3,30}$/.test(username);
}

function safeFieldError(field, message) {
  return { field, message };
}

router.post('/register', express.json(), async (req, res) => {
  try {
    const errors = [];

    const username = typeof req.body.username === 'string' ? req.body.username.trim() : '';
    const emailRaw = typeof req.body.email === 'string' ? req.body.email.trim() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const confirmPassword = typeof req.body.confirmPassword === 'string' ? req.body.confirmPassword : '';

    // Validate username
    if (!username) {
      errors.push(safeFieldError('username', 'Username is required.'));
    } else if (!isValidUsername(username)) {
      errors.push(safeFieldError('username', 'Username must be 3-30 characters and contain only letters, numbers, or underscores.'));
    }

    // Validate email
    if (!emailRaw) {
      errors.push(safeFieldError('email', 'Email is required.'));
    } else if (!validator.isEmail(emailRaw)) {
      errors.push(safeFieldError('email', 'Email format is invalid.'));
    }

    // Validate password
    if (!password) {
      errors.push(safeFieldError('password', 'Password is required.'));
    } else if (!isStrongPassword(password)) {
      errors.push(safeFieldError(
        'password',
        'Password must be at least 12 characters and include uppercase, lowercase, a number, and a special character.'
      ));
    }

    // Confirm password
    if (!confirmPassword) {
      errors.push(safeFieldError('confirmPassword', 'Please confirm your password.'));
    } else if (password && confirmPassword !== password) {
      errors.push(safeFieldError('confirmPassword', 'Passwords do not match.'));
    }

    // If any validation errors, return them without exposing account existence details.
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        errors,
      });
    }

    const email = normalizeEmail(emailRaw);

    // Generic uniqueness checks; do not reveal whether email or username already exists.
    const existingUser = users.find(
      (u) => u.email === email || u.username.toLowerCase() === username.toLowerCase()
    );

    if (existingUser) {
      return res.status(409).json({
        success: false,
        errors: [
          {
            field: 'registration',
            message: 'Registration could not be completed with the provided information.',
          },
        ],
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const newUser = {
      id: String(Date.now()),
      username,
      email,
      passwordHash,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully.',
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      errors: [
        {
          field: 'server',
          message: 'An unexpected error occurred.',
        },
      ],
    });
  }
});

module.exports = router;