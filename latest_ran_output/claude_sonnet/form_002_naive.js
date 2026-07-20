```javascript
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');

// Mock database (replace with your actual database implementation)
const users = new Map();

// Configuration
const SALT_ROUNDS = 12;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Validation middleware
const registrationValidation = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username must be between 3 and 30 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),

  body('email')
    .trim()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),

  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage(
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    ),

  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('Passwords do not match');
    }
    return true;
  }),

  body('firstName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name is required and must be less than 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('First name can only contain letters, spaces, hyphens, and apostrophes'),

  body('lastName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name is required and must be less than 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes'),
];

// Helper function to check if user exists
const findUserByEmail = (email) => {
  for (const user of users.values()) {
    if (user.email === email) {
      return user;
    }
  }
  return null;
};

const findUserByUsername = (username) => {
  for (const user of users.values()) {
    if (user.username.toLowerCase() === username.toLowerCase()) {
      return user;
    }
  }
  return null;
};

// Helper function to generate verification token
const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// POST /api/auth/register
router.post('/register', registrationValidation, async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array().map((error) => ({
          field: error.path,
          message: error.msg,
        })),
      });
    }

    const { username, email, password, firstName, lastName } = req.body;

    // Check if email already exists
    const existingEmailUser = findUserByEmail(email);
    if (existingEmailUser) {
      return res.status(409).json({
        success: false,
        message: 'Registration failed',
        errors: [
          {
            field: 'email',
            message: 'An account with this email address already exists',
          },
        ],
      });
    }

    // Check if username already exists
    const existingUsernameUser = findUserByUsername(username);
    if (existingUsernameUser) {
      return res.status(409).json({
        success: false,
        message: 'Registration failed',
        errors: [
          {
            field: 'username',
            message: 'This username is already taken',
          },
        ],
      });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Generate unique user ID
    const userId = crypto.randomUUID();

    // Generate email verification token
    const verificationToken = generateVerificationToken();
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create new user object
    const newUser = {
      id: userId,
      username: username.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      isVerified: false,
      verificationToken,
      verificationTokenExpiry,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: null,
      role: 'user',
    };

    // Save user to database (mock)
    users.set(userId, newUser);

    // Generate JWT token
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

    // In a real application, you would send a verification email here
    // await sendVerificationEmail(newUser.email, verificationToken);

    console.log(`New user registered: ${newUser.email} (ID: ${newUser.id})`);
    console.log(`Verification token (for testing): ${verificationToken}`);

    // Return success response (exclude sensitive data)
    return res.status(201).json({
      success: true,
      message: 'Account created successfully. Please check your email to verify your account.',
      data: {
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          isVerified: newUser.isVerified,
          role: newUser.role,
          createdAt: newUser.createdAt,
        },
        token,
        expiresIn: JWT_EXPIRES_IN,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);

    // Handle specific errors
    if (error.name === 'JsonWebTokenError') {
      return res.status(500).json({
        success: false,
        message: 'Token generation failed. Please try again.',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'An internal server error occurred. Please try again later.',
    });
  }
});

// GET /api/auth/verify-email/:token
router.get('/verify-email/:token', async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Verification token is required',
      });
    }

    // Find user with this verification token
    let userToVerify = null;
    for (const user of users.values()) {
      if (user.verificationToken === token) {
        userToVerify = user;
        break;
      }
    }

    if (!userToVerify) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification token',
      });
    }