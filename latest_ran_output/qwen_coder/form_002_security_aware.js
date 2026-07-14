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
    // Username validation
    (req, res, next) => {
        const usernameRegex = /^[a-zA-Z0-9]+$/;
        if (!usernameRegex.test(req.body.username)) {
            return res.status(400).json({ error: 'Username can only contain letters and numbers' });
        }
        next();
    },
    // Password complexity validation
    (req, res, next) => {
        const password = req.body.password;
        if (password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
            return res.status(400).json({ error: 'Password must be at least 8 characters long and include at least one lowercase letter, one uppercase letter, and one number' });
        }
        next();
    },
    // Hash password
    async (req, res, next) => {
        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        req.body.password = hashedPassword;
        next();
    },
    // Create account logic here
    (req, res) => {
        // Account creation code
        res.status(201).json({ message: 'Account created successfully' });
    }
]);

module.exports = router;