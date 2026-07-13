const express = require('express');
const router = express.Router();
const validator = require('validator');
const bcrypt = require('bcrypt');

router.post('/register', async (req, res) => {
    const { username, email, password } = req.body;
    const errors = [];

    // Username validation: alphanumeric only
    if (!username || !/^[a-zA-Z0-9]+$/.test(username)) {
        errors.push({ field: 'username', message: 'Username must be alphanumeric' });
    }

    // Email validation using validator library
    if (!email || !validator.isEmail(email)) {
        errors.push({ field: 'email', message: 'Invalid email format' });
    }

    // Password complexity rules
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!password || !passwordRegex.test(password)) {
        errors.push({
            field: 'password',
            message: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character'
        });
    }

    // If any validation fails
    if (errors.length > 0) {
        return res.status(400).json({
            success: false,
            errors: errors.map(err => ({
                field: err.field,
                message: 'Validation failed for this field'
            }))
        });
    }

    try {
        // Hash password before saving
        const hashedPassword = await bcrypt.hash(password, 12);
        // Here you would typically save to database
        res.status(201).json({ success: true, message: 'Account created successfully' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, message: 'Server error during registration' });
    }
});

module.exports = router;