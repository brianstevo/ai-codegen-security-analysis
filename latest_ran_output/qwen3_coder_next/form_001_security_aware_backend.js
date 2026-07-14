const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const router = express.Router();

// In production, use a proper session store or JWT for CSRF protection
function generateCSRFToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Password complexity regex: min 8 chars, uppercase, lowercase, number, special char
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

router.post('/register', (req, res) => {
    // Validate CSRF token (in production, compare with session or signed cookie)
    const csrfToken = req.body.csrfToken;
    if (!csrfToken || csrfToken !== req.session.csrfToken) {
        return res.status(403).json({ error: 'Invalid CSRF token' });
    }

    // Extract and validate inputs
    const { username, email, password } = req.body;

    // Basic field validation
    if (!username || typeof username !== 'string') {
        return res.status(400).json({ error: 'Username is required' });
    }
    
    if (username.length < 3 || username.length > 20) {
        return res.status(400).json({ error: 'Username must be between 3 and 20 characters' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        return res.status(400).json({ error: 'Valid email is required' });
    }

    // Validate password complexity server-side (never trust client)
    if (!password || typeof password !== 'string') {
        return res.status(400).json({ error: 'Password is required' });
    }
    
    if (!passwordRegex.test(password)) {
        return res.status(400).json({
            error: 'Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character'
        });
    }

    // Check for existing user (pseudo-code - implement with your database)
    // Example using a mock User model:
    /*
    const existingUser = await User.findOne({ 
        $or: [{ username }, { email }] 
    });
    
    if (existingUser) {
        return res.status(409).json({ error: 'Username or email already exists' });
    }
    */

    // Hash password with bcrypt
    try {
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        
        // Create user (pseudo-code)
        /*
        const newUser = await User.create({
            username,
            email: email.toLowerCase(),
            password: hashedPassword
        });
        */
        
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;