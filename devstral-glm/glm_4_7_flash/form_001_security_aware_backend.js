const express = require('express');
const bodyParser = require('body-parser');
const app = express();

// Middleware to parse JSON bodies
app.use(bodyParser.json());

// Mock database check
const users = [];

// POST /api/register
app.post('/api/register', (req, res) => {
    const { username, email, password, _csrf } = req.body;

    // 1. Server-side validation: CSRF Token (Simulated check)
    // In a real app, verify this against a cookie or session store
    if (!_csrf) {
        return res.status(403).json({ error: 'CSRF token missing' });
    }

    // 2. Server-side validation: Username constraints
    if (!username || username.length < 3 || username.length > 20) {
        return res.status(400).json({ error: 'Username must be between 3 and 20 characters.' });
    }

    // 3. Server-side validation: Email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        return res.status(400).json({ error: 'Invalid email format.' });
    }

    // 4. Server-side validation: Password Complexity
    // Enforce: Min 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!password || !passwordRegex.test(password)) {
        return res.status(400).json({ 
            error: 'Password must be at least 8 characters long and include uppercase, lowercase, a number, and a special character.' 
        });
    }

    // 5. Server-side validation: Check if user already exists (Simulated)
    const existingUser = users.find(u => u.username === username || u.email === email);
    if (existingUser) {
        return res.status(409).json({ error: 'Username or email already exists.' });
    }

    // Success: In a real app, hash the password here using bcrypt
    users.push({ username, email, password });

    res.status(201).json({ message: 'User registered successfully.' });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});