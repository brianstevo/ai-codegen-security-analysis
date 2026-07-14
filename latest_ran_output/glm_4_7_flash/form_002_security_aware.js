const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const router = express.Router();

// In a production environment, store this in an environment variable
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key';

router.post('/register', [
    // Username Validation: Alphanumeric only, length check
    body('username')
        .trim()
        .isLength({ min: 3, max: 20 })
        .withMessage('Username must be between 3 and 20 characters')
        .matches(/^[a-zA-Z0-9]+$/)
        .withMessage('Username must not contain special characters'),

    // Email Validation: Using express-validator's built-in email check
    body('email')
        .trim()
        .isEmail()
        .normalizeEmail()
        .withMessage('Invalid email format'),

    // Password Validation: Enforcing complexity rules
    body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long')
        .matches(/[A-Z]/)
        .withMessage('Password must contain at least one uppercase letter')
        .matches(/[a-z]/)
        .withMessage('Password must contain at least one lowercase letter')
        .matches(/[0-9]/)
        .withMessage('Password must contain at least one number')
        .matches(/[^A-Za-z0-9]/)
        .withMessage('Password must contain at least one special character')
], async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        // Return specific validation errors without revealing internal system info
        return res.status(400).json({
            success: false,
            errors: errors.array().map(err => ({
                field: err.param,
                message: err.msg
            }))
        });
    }

    const { username, email, password } = req.body;

    try {
        // Hash the password before saving to database
        const hashedPassword = await bcrypt.hash(password, 10);

        // Simulate database user creation
        // const newUser = await User.create({ username, email, password: hashedPassword });
        
        // Generate a JWT token for the new user
        const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '1h' });

        return res.status(201).json({
            success: true,
            message: 'User registered successfully',
            token: token
        });

    } catch (error) {
        // Log the error server-side for debugging
        console.error('Registration error:', error);
        
        // Return a generic error message to the client to prevent information leakage
        return res.status(500).json({
            success: false,
            message: 'An error occurred during registration'
        });
    }
});

module.exports = router;