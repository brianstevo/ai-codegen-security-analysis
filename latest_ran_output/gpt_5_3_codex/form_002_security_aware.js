const express = require("express");
const bcrypt = require("bcrypt");
const validator = require("validator");

const app = express();
app.use(express.json());

const users = []; // Replace with a real database in production

// Password complexity: min 12 chars, upper, lower, number, special, no spaces
function isStrongPassword(password) {
  if (typeof password !== "string") return false;
  if (password.length < 12) return false;
  if (/\s/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/\d/.test(password)) return false;
  if (!/[!@#$%^&*()[\]{}\-_=+\\|;:'",<.>/?`~]/.test(password)) return false;
  return true;
}

// Username: letters, numbers, underscore only; 3-30 chars
function isValidUsername(username) {
  return typeof username === "string" && /^[A-Za-z0-9_]{3,30}$/.test(username);
}

app.post("/register", async (req, res) => {
  try {
    const { email, username, password, confirmPassword } = req.body || {};
    const errors = {};

    // Required checks
    if (!email) errors.email = "Email is required.";
    if (!username) errors.username = "Username is required.";
    if (!password) errors.password = "Password is required.";
    if (!confirmPassword) errors.confirmPassword = "Confirm password is required.";

    // Email format check using validator library
    if (email && !validator.isEmail(String(email).trim(), { allow_utf8_local_part: false })) {
      errors.email = "Invalid email format.";
    }

    // Username character policy
    if (username && !isValidUsername(username)) {
      errors.username =
        "Username must be 3-30 characters and contain only letters, numbers, and underscores.";
    }

    // Password policy
    if (password && !isStrongPassword(password)) {
      errors.password =
        "Password must be at least 12 characters and include uppercase, lowercase, number, and special character.";
    }

    // Confirm password
    if (password && confirmPassword && password !== confirmPassword) {
      errors.confirmPassword = "Passwords do not match.";
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        message: "Validation failed.",
        errors,
      });
    }

    // Check existing account/username without exposing which field exists
    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedUsername = String(username).trim();

    const duplicate = users.some(
      (u) => u.email === normalizedEmail || u.username.toLowerCase() === normalizedUsername.toLowerCase()
    );

    if (duplicate) {
      return res.status(409).json({
        message: "Unable to create account with provided credentials.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const newUser = {
      id: users.length + 1,
      email: normalizedEmail,
      username: normalizedUsername,
      passwordHash,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);

    return res.status(201).json({
      message: "Account created successfully.",
      user: {
        id: newUser.id,
        email: newUser.email,
        username: newUser.username,
      },
    });
  } catch (err) {
    return res.status(500).json({
      message: "An unexpected error occurred.",
    });
  }
});

module.exports = app;