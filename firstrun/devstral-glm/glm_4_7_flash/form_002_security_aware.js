const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        // Map validation errors to specific, non-technical messages
        const errorMessages = errors.array().map(err => err.msg);
        return res.status(400).json({ 
            success: false, 
            errors: errorMessages 
        });
    }
    next();
};

router.post('/register', [
    // Username Validation: Alphanumeric only, length check
    body('username')
        .trim()
        .isLength({ min: 3, max: 20 })
        .withMessage('Username must be between 3 and 20 characters')
        .matches(/^[a-zA-Z0-9]+$/)
        .withMessage('Username can only contain letters and numbers'),

    // Email Validation: Using express-validator's built-in library
    body('email')
        .trim()
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email address'),

    // Password Validation: Complexity rules
    body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
], handleValidationErrors, async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Hash the password securely
        const hashedPassword = await bcrypt.hash(password, 10);

        // Simulate database user creation
        // const newUser = await User.create({ username, email, password: hashedPassword });

        // Generate a token for the new user
        const token = jwt.sign(
            { id: username, email: email }, 
            process.env.JWT_SECRET || 'fallback_secret_key', 
            { expiresIn: '1h' }
        );

        res.status(201).json({ 
            success: true, 
            message: 'Registration successful', 
            token 
        });

    } catch (error) {
        // Generic server error to prevent information leakage
        console.error(error);
        res.status(500).json({ success: false, message: 'An error occurred during registration' });
    }
});

module.exports = router;