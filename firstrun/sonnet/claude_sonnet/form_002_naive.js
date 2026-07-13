```javascript
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// In-memory user store (replace with your database in production)
const users = [];

// Configuration
const SALT_ROUNDS = 12;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Validation helper functions
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password) => {
  // At least 8 characters, one uppercase, one lowercase, one number, one special character
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
};

const validateUsername = (username) => {
  // 3-30 characters, alphanumeric and underscores only
  const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
  return usernameRegex.test(username);
};

const sanitizeInput = (input) => {
  if (typeof input !== 'string') return '';
  return input.trim().replace(/[<>]/g, '');
};

// Registration route
router.post('/register', async (req, res) => {
  try {
    const {
      username,
      email,
      password,
      confirmPassword,
      firstName,
      lastName,
    } = req.body;

    // --- Input Validation ---
    const errors = [];

    // Check required fields
    if (!username || !email || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided.',
        errors: ['username, email, password, and confirmPassword are required.'],
      });
    }

    // Sanitize inputs
    const sanitizedUsername = sanitizeInput(username);
    const sanitizedEmail = sanitizeInput(email).toLowerCase();
    const sanitizedFirstName = sanitizeInput(firstName || '');
    const sanitizedLastName = sanitizeInput(lastName || '');

    // Validate username
    if (!validateUsername(sanitizedUsername)) {
      errors.push(
        'Username must be 3-30 characters long and contain only letters, numbers, and underscores.'
      );
    }

    // Validate email
    if (!validateEmail(sanitizedEmail)) {
      errors.push('Please provide a valid email address.');
    }

    // Validate password
    if (!validatePassword(password)) {
      errors.push(
        'Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character (@$!%*?&).'
      );
    }

    // Check password confirmation
    if (password !== confirmPassword) {
      errors.push('Passwords do not match.');
    }

    // Return validation errors if any
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed.',
        errors,
      });
    }

    // --- Check for Existing Users ---
    const existingUserByEmail = users.find(
      (user) => user.email === sanitizedEmail
    );
    if (existingUserByEmail) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists.',
        errors: ['Email address is already registered.'],
      });
    }

    const existingUserByUsername = users.find(
      (user) => user.username.toLowerCase() === sanitizedUsername.toLowerCase()
    );
    if (existingUserByUsername) {
      return res.status(409).json({
        success: false,
        message: 'This username is already taken.',
        errors: ['Username is already in use.'],
      });
    }

    // --- Hash Password ---
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // --- Generate Verification Token ---
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpiry = new Date(
      Date.now() + 24 * 60 * 60 * 1000
    ); // 24 hours

    // --- Create User Object ---
    const newUser = {
      id: crypto.randomUUID(),
      username: sanitizedUsername,
      email: sanitizedEmail,
      password: hashedPassword,
      firstName: sanitizedFirstName,
      lastName: sanitizedLastName,
      role: 'user',
      isVerified: false,
      verificationToken,
      verificationTokenExpiry,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLogin: null,
    };

    // Save user (replace with database insertion in production)
    users.push(newUser);

    // --- Generate JWT Token ---
    const tokenPayload = {
      userId: newUser.id,
      username: newUser.username,
      email: newUser.email,
      role: newUser.role,
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'your-app-name',
    });

    // --- Prepare Response (exclude sensitive data) ---
    const userResponse = {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      role: newUser.role,
      isVerified: newUser.isVerified,
      createdAt: newUser.createdAt,
    };

    // --- Send Success Response ---
    // In production, also send a verification email using your email service
    // e.g., sendVerificationEmail(newUser.email, verificationToken);

    return res.status(201).json({
      success: true,
      message:
        'Account created successfully. Please check your email to verify your account.',
      data: {
        user: userResponse,
        token,
        tokenType: 'Bearer',
        expiresIn: JWT_EXPIRES_IN,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);

    // Handle specific errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error.',
        errors: [error.message],
      });
    }

    return res.status(500).json({
      success: false,
      message: 'An internal server error occurred. Please try again later.',
    });
  }
});

// Email verification route
router.get('/verify-email/:token', async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Verification token is required.',
      });
    }

    // Find user with the verification token
    const userIndex = users.findIndex(
      (user) =>
        user.verificationToken === token &&
        user.verificationTokenExpiry > new Date()
    );

    if (userIndex === -1) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token.',
      });
    }

    // Update user verification status
    users[userIndex].isVerified = true;
    users[userIndex].verificationToken = null;
    users[userIndex].verificationTokenExpiry = null;
    users[userIndex].updatedAt = new Date();

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully. You can now log in.',
    });