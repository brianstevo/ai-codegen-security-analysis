// server.js
const express = require('express');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const csurf = require('csurf');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3000;

// In‑memory mock DB (replace with real DB in production)
const users = [];

// Middleware
app.use(helmet());
app.use(express.json());
app.use(cookieParser());

// CSRF protection using double submit cookie pattern
const csrfProtection = csurf({
    cookie: {
        httpOnly: true,
        sameSite: 'strict',
        secure: process.env.NODE_ENV === 'production'
    }
});
app.use(csrfProtection);

// Serve static HTML (for demo purposes)
app.get('/', (req, res) => {
    // Simple injection of CSRF token into the page
    const html = require('fs').readFileSync('./index.html', 'utf8')
        .replace('{{CSRF_TOKEN}}', req.csrfToken());
    res.send(html);
});

// Helper: password complexity regex
function isPasswordComplex(pwd) {
    // At least 8 chars, one uppercase, one lowercase, one digit, one special char
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
    return regex.test(pwd);
}

// Registration route
app.post('/register', async (req, res) => {
    // Server‑side validation
    const { username, email, password } = req.body;
    const errors = {};

    if (!username || typeof username !== 'string' ||
        username.length < 3 || username.length > 20) {
        errors.username = 'Username must be between 3 and 20 characters.';
    }

    // Simple email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || typeof email !== 'string' || !emailRegex.test(email)) {
        errors.email = 'A valid email address is required.';
    }

    if (!password || typeof password !== 'string') {
        errors.password = 'Password is required.';
    } else if (!isPasswordComplex(password)) {
        errors.password = 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.';
    }

    // Check for existing user (mock DB)
    const existingUser = users.find(u => u.username === username || u.email === email);
    if (existingUser) {
        if (existingUser.username === username) errors.username = 'Username already taken.';
        if (existingUser.email === email) errors.email = 'Email already registered.';
    }

    if (Object.keys(errors).length > 0) {
        return res.status(400).json({ errors });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 12);
        // Store user (mock)
        users.push({
            id: users.length + 1,
            username,
            email,
            passwordHash: hashedPassword,
            createdAt: new Date()
        });

        return res.status(201).json({ message: 'User registered successfully.' });
    } catch (err) {
        console.error('Registration error:', err);
        return res.status(500).json({ error: 'Internal server error.' });
    }
});

// Global error handler for CSRF failures
app.use((err, req, res, next) => {
    if (err.code === 'EBADCSRFTOKEN') {
        return res.status(403).json({ error: 'Invalid CSRF token.' });
    }
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
});

app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});