const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const router = express.Router();

// Example in-memory "database" for demonstration purposes.
// Replace with your real database model/ORM calls.
const users = [];

/**
 * POST /register
 * Expected body:
 * {
 *   "name": "Jane Doe",
 *   "email": "jane@example.com",
 *   "password": "StrongPassword123!"
 * }
 */
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    // Basic validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required.'
      });
    }

    const trimmedName = String(name).trim();
    const normalizedEmail = String(email).trim().toLowerCase();
    const plainPassword = String(password);

    if (trimmedName.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Name must be at least 2 characters long.'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.'
      });
    }

    if (plainPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long.'
      });
    }

    // Check for existing user
    const existingUser = users.find((u) => u.email === normalizedEmail);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.'
      });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(plainPassword, saltRounds);

    // Create user record
    const newUser = {
      id: crypto.randomUUID(),
      name: trimmedName,
      email: normalizedEmail,
      passwordHash,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        createdAt: newUser.createdAt
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
});

module.exports = router;