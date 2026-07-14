const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const app = express();

// Middleware to parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mock database (In production, use PostgreSQL, MongoDB, etc.)
const usersDB = [];

// Mock CSRF Secret (In production, use a secure session-based CSRF library like csurf)
const CSRF_SECRET = 'super-secret-key-change-in-production';

// Helper function to generate a simple CSRF token for demonstration
function generateCSRFToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Helper function to verify CSRF token (Simplified for demo; use csurf in production)
function verifyCSRFToken(req, res, next) {
    const token = req.body._csrf || req.query._csrf;
    if (!token || token !== 'simulated-csrf-token-value-12345') {
        return res.status(403).json({ error: 'Invalid CSRF token' });
    }
    next();
}

// Password Complexity Validation Function
function validatePasswordComplexity(password) {
    const minLength = 8;
    const maxLength = 128;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (password.length < minLength || password.length > maxLength) {
        return 'Password must be between 8 and 128 characters.';
    }
    if (!hasUpperCase) {
        return 'Password must contain at least one uppercase letter.';
    }
    if (!hasLowerCase) {
        return 'Password must contain at least one lowercase letter.';
    }
    if (!hasNumber) {
        return 'Password must contain at least one number.';
    }
    if (!hasSpecialChar) {
        return 'Password must contain at least one special character.';
    }
    return null; // No errors
}

// Registration Route
app.post('/api/register', verifyCSRFToken, async (req, res) => {
    try {
        const { username, email, password, confirmPassword } = req.body;

        // 1. Server-side Validation: Check for missing fields
        if (!username || !email || !password || !confirmPassword) {
            return res.status(400).json({ error: 'All fields are required.' });
        }

        // 2. Server-side Validation: Validate Username format and length
        const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
        if (!usernameRegex.test(username)) {
            return res.status(400).json({ error: 'Username must be 3-20 characters, alphanumeric and underscores only.' });
        }

        // 3. Server-side Validation: Validate Email format (basic check)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email format.' });
        }

        // 4. Server-side Validation: Check if passwords match (Never trust client)
        if (password !== confirmPassword) {
            return res.status(400).json({ error: 'Passwords do not match.' });
        }

        // 5. Server-side Validation: Enforce Password Complexity
        const passwordError = validatePasswordComplexity(password);
        if (passwordError) {
            return res.status(400).json({ error: passwordError });
        }

        // 6. Check if user already exists
        const existingUser = usersDB.find(user => user.email === email || user.username === username);
        if (existingUser) {
            return res.status(409).json({ error: 'Username or email already exists.' });
        }

        // 7. Hash the password before storing
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // 8. Save user to database (mock)
        const newUser = {
            id: crypto.randomUUID(),
            username,
            email,
            password: hashedPassword,
            createdAt: new Date()
        };
        usersDB.push(newUser);

        // 9. Respond with success (Do not send back the password or sensitive data)
        res.status(201).json({ 
            message: 'User registered successfully.', 
            userId: newUser.id 
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;