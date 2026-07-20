const express = require('express');
const bcrypt = require('bcrypt');
const validator = require('validator');

const router = express.Router();

// In-memory placeholder. Replace with your database access layer.
const users = [];

/**
 * POST /register
 * Server-side validation only. Do not rely on client-side HTML validation.
 */
router.post('/register', async (req, res) => {
  try {
    const { email, username, password, confirmPassword } = req.body || {};
    const errors = {};

    // Basic normalization
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const normalizedUsername = typeof username === 'string' ? username.trim() : '';
    const pwd = typeof password === 'string' ? password : '';
    const cpwd = typeof confirmPassword === 'string' ? confirmPassword : '';

    // Email validation using a library
    if (!normalizedEmail || !validator.isEmail(normalizedEmail)) {
      errors.email = 'Enter a valid email address.';
    }

    // Username validation: allow only letters, numbers, underscores, and hyphens
    // Reject special characters and whitespace.
    if (!normalizedUsername) {
      errors.username = 'Username is required.';
    } else if (!/^[A-Za-z0-9_-]{3,20}$/.test(normalizedUsername)) {
      errors.username = 'Username must be 3-20 characters and contain only letters, numbers, underscores, or hyphens.';
    }

    // Password complexity rules
    // Minimum 12 chars, at least one uppercase, one lowercase, one number, one special character.
    if (!pwd) {
      errors.password = 'Password is required.';
    } else {
      const passwordChecks = [
        { ok: pwd.length >= 12, msg: 'Password must be at least 12 characters long.' },
        { ok: /[a-z]/.test(pwd), msg: 'Password must include a lowercase letter.' },
        { ok: /[A-Z]/.test(pwd), msg: 'Password must include an uppercase letter.' },
        { ok: /[0-9]/.test(pwd), msg: 'Password must include a number.' },
        { ok: /[^A-Za-z0-9]/.test(pwd), msg: 'Password must include a special character.' },
      ];

      const failed = passwordChecks.filter((c) => !c.ok).map((c) => c.msg);
      if (failed.length) {
        errors.password = failed[0]; // Return one specific issue at a time to reduce signal
      }
    }

    // Confirm password
    if (!cpwd) {
      errors.confirmPassword = 'Please confirm your password.';
    } else if (pwd && cpwd !== pwd) {
      errors.confirmPassword = 'Passwords do not match.';
    }

    // If any validation errors exist, return them without leaking account existence
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Please correct the highlighted fields and try again.',
        errors,
      });
    }

    // Optional: Check for existing account without revealing whether email already exists
    const accountExists = users.some(
      (u) => u.email === normalizedEmail || u.username === normalizedUsername
    );

    if (accountExists) {
      // Generic response to avoid username/email enumeration
      return res.status(409).json({
        success: false,
        message: 'Unable to create account with the provided information.',
      });
    }

    const passwordHash = await bcrypt.hash(pwd, 12);

    const newUser = {
      id: cryptoRandomId(),
      email: normalizedEmail,
      username: normalizedUsername,
      passwordHash,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully.',
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred.',
    });
  }
});

function cryptoRandomId() {
  // Simple unique ID generator without exposing sensitive information
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2)
  ).slice(0, 24);
}

module.exports = router;