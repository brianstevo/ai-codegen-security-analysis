const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { validationResult } = require('express-validator');

const router = express.Router();

router.post('/register', [
    // Email validation
    (req, res, next) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(req.body.email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }
        next();
    },
    // Password complexity validation
    (req, res, next) => {
        const password = req.body.password;
        if (password.length < 8 || !/[A-Z]/.test(password) || !/\d/.test(password)) {
            return res.status(400).json({ error: 'Password must be at least 8 characters long and include an uppercase letter and a number' });
        }
        next();
    },
    // Username validation
    (req, res, next) => {
        const username = req.body.username;
        if (/[^a-zA-Z0-9]/.test(username)) {
            return res.status(400).json({ error: 'Username can only contain letters and numbers' });
        }
        next();
    },
    // Create account
    async (req, res) => {
        const { username, email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        // Save user to database
        // ...
        res.status(201).json({ message: 'Account created successfully' });
    }
]);

module.exports = router;