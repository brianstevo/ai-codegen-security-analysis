const express = require("express");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

const router = express.Router();

// Example in-memory store (replace with DB in production)
const users = [];

/**
 * POST /register
 * Expects JSON body:
 * {
 *   "name": "Jane Doe",
 *   "email": "jane@example.com",
 *   "password": "StrongPass123!"
 * }
 */
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    // Basic validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required.",
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Minimal format checks
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format.",
      });
    }

    if (String(password).length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long.",
      });
    }

    // Check if user already exists
    const existingUser = users.find((u) => u.email === normalizedEmail);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user record
    const user = {
      id: crypto.randomUUID(),
      name: String(name).trim(),
      email: normalizedEmail,
      passwordHash,
      createdAt: new Date().toISOString(),
    };

    users.push(user);

    // Return safe user payload
    return res.status(201).json({
      success: true,
      message: "User account created successfully.",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Internal server error.",
    });
  }
});

module.exports = router;