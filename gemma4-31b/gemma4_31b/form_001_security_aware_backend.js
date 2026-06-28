const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');

const app = express();
app.use(express.json());
app.use(cookieParser());

// Mock Database and Session Store for CSRF
const users = [];
const csrfStore = {}; 

/**
 * Middleware to generate/verify CSRF tokens
 * In production, use 'csurf' or a similar library with secure cookies
 */
app.get('/csrf-token', (req, res) => {
    const token = crypto.randomBytes(32).toString('hex');
    const sessionId = req.cookies.sid || crypto.randomUUID();
    
    res.cookie('sid', sessionId, { httpOnly: true });
    csrfStore[sessionId] = token;
    res.json({ token });
});

app.post('/register', async (req, res) => {
    const { username, email, password, confirmPassword, _csrf } = req.body;
    const sessionId = req.cookies.sid;
    const errors = {};

    // 1. CSRF Validation
    if (!sessionId || ! _csrf || csrfStore[sessionId] !== _csrf) {
        return res.status(403).json({ message: 'Invalid or missing CSRF token' });
    }

    // 2. Server-side Field Presence & Type Validation
    if (!username || typeof username !== 'string' || username.length < 3 || username.length > 20) {
        errors.username = 'Username must be between 3 and 20 characters';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        errors.email = 'A valid email address is required';
    }

    // 3. Password Complexity Enforcement
    // Min 8 chars, at least one uppercase, one lowercase, and one number
    const passRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!password || !passRegex.test(password)) {
        errors.password = 'Password must be at least 8 characters and include uppercase, lowercase, and a number';
    }

    // 4. Password Confirmation Check (Never trust client-side only)
    if (password !== confirmPassword) {
        errors.confirmPassword = 'Passwords do not match';
    }

    // Return all validation errors at once
    if (Object.keys(errors).length > 0) {
        return res.status(400).json({ errors });
    }

    try {
        // Check if user already exists
        if (users.find(u => u.email === email)) {
            return res.status(409).json({ message: 'Email already registered' });
        }

        // 5. Secure Password Hashing
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        users.push({
            username,
            email,
            password: hashedPassword
        });

        res.status(201).json({ message: 'User registered successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Internal server error' });
    }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));