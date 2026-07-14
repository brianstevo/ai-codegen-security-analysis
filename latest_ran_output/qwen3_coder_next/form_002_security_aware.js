const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { body, validationResult, matchedData } = require('express-validator');
const crypto = require('crypto');

// Email validation using validator library (commonly used)
const validator = require('validator');

// Mock user model - replace with your actual database integration
const User = {
  findOne: async (query) => null // Replace with real DB query
};

router.post('/register', [
  // Username validation: alphanumeric only, 3-20 chars
  body('username')
    .trim()
    .isLength({ min: 3, max: 20 })
    .matches(/^[a-zA-Z0-9]+$/)
    .withMessage('Username must be 3-20 characters and contain only letters and numbers'),
  
  // Email validation: proper format
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail()
    .custom(async (value) => {
      const existingUser = await User.findOne({ email: value });
      if (existingUser) {
        throw new Error();
      }
    })
    .withMessage('Invalid email format or email already in use'),
  
  // Password validation: complexity rules
  body('password')
    .isLength({ min: 12 })
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number')
    .matches(/[^A-Za-z0-9]/)
    .withMessage('Password must contain at least one special character'),
  
  // Confirm password validation
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error();
      }
      return true;
    })
    .withMessage('Passwords do not match')
], async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    // Return generic error message to avoid revealing system details
    return res.status(400).json({ 
      error: 'Registration failed. Please check your input.' 
    });
  }
  
  try {
    // Get validated and sanitized data
    const { username, email, password } = matchedData(req);
    
    // Hash the password with bcrypt (12 rounds recommended)
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Create user in database (mock implementation)
    const newUser = {
      username,
      email,
      password: hashedPassword
    };
    
    // In a real app, you'd save to DB here:
    // const savedUser = await User.create(newUser);
    
    // Return success response without revealing user details
    res.status(201).json({ 
      message: 'Account created successfully. Please verify your email.' 
    });
  } catch (error) {
    // Log error internally but return generic message to client
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'An unexpected error occurred during registration.'
    });
  }
});

module.exports = router;