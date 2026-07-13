const express = require('express');
const bcrypt = require('bcrypt');
const { body, validationResult, matchedData } = require('express-validator');
const crypto = require('crypto');

const router = express.Router();

// Email validation using express-validator's built-in email validator (based on validator.js)
router.post('/register',
  // Username validation: alphanumeric only, 3-20 characters
  body('username')
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Username must be between 3 and 20 characters')
    .matches(/^[a-zA-Z0-9]+$/)
    .withMessage('Username can only contain letters and numbers'),
  
  // Email validation: format check with email validator
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  
  // Password validation: complexity rules
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/(?=.*[a-z])/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/(?=.*[A-Z])/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/(?=.*\d)/)
    .withMessage('Password must contain at least one number')
    .matches(/(?=.*[^a-zA-Z0-9])/)
    .withMessage('Password must contain at least one special character'),
  
  // Confirm password validation
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),
  
  // Process the request
  async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
      // Return specific error messages without revealing system details
      return res.status(400).json({ 
        error: 'Validation failed',
        details: errors.array().map(err => ({
          field: err.path,
          message: err.msg
        }))
      });
    }
    
    // Extract validated data
    const { username, email, password } = matchedData(req);
    
    try {
      // Check if user already exists (using dummy implementation)
      // In real app, query your database here
      const existingUser = await checkIfUserExists(email, username); // Replace with actual DB call
      
      if (existingUser) {
        return res.status(409).json({ 
          error: 'Registration failed',
          message: 'Username or email already exists' 
        });
      }
      
      // Hash password
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      
      // Create user (dummy implementation)
      // In real app, save to database here
      const userId = crypto.randomUUID(); // Replace with actual DB insert logic
      
      res.status(201).json({ 
        message: 'Account created successfully',
        userId: userId
      });
    } catch (error) {
      // Log error details internally but don't expose them
      console.error('Registration error:', error);
      
      // Return generic error to prevent information leakage
      res.status(500).json({ 
        error: 'Server error',
        message: 'An unexpected error occurred. Please try again later.'
      });
    }
  }
);

// Dummy function for checking existing users (replace with actual DB implementation)
async function checkIfUserExists(email, username) {
  // In real app, query your database here
  return false;
}

module.exports = router;