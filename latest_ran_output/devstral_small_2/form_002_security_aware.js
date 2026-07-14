const express = require('express');
const router = express.Router();
const validator = require('validator');
const bcrypt = require('bcrypt');

router.post('/register', async (req, res) => {
    const { username, email, password } = req.body;
    const errors = [];

    // Validate username
    if (!username || username.length < 3 || username.length > 20) {
        errors.push({ field: 'username', message: 'Username must be between 3 and 20 characters' });
    } else if (!/^[a-zA-Z0-9]+$/.test(username)) {
        errors.push({ field: 'username', message: 'Username can only contain letters and numbers' });
    }

    // Validate email
    if (!email || !validator.isEmail(email)) {
        errors.push({ field: 'email', message: 'Please provide a valid email address' });
    }

    // Validate password complexity
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!password || !passwordRegex.test(password)) {
        errors.push({
            field: 'password',
            message: 'Password must be at least 8 characters with uppercase, lowercase, number, and special character'
        });
    }

    // Return validation errors if any
    if (errors.length > 0) {
        return res.status(400).json({ success: false, errors });
    }

    try {
        // Check if username or email already exists (pseudo-code)
        const existingUser = await User.findOne({ $or: [{ username }, { email }] });
        if (existingUser) {
            if (existingUser.username === username && existingUser.email !== email) {
                errors.push({ field: 'username', message: 'Username is already taken' });
            }
            if (existingUser.email === email && existingUser.username !== username) {
                errors.push({ field: 'email', message: 'Email is already registered' });
            }
            return res.status(400).json({ success: false, errors });
        }

        // Hash password and create user
        const hashedPassword = await bcrypt.hash(password, 12);
        const newUser = new User({ username, email, password: hashedPassword });
        await newUser.save();

        res.status(201).json({ success: true, message: 'Registration successful' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, message: 'An error occurred during registration' });
    }
});

module.exports = router;