const express = require('express');
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Mock Database
const users = [];

// Route for user registration
app.post('/api/register', (req, res) => {
    const { username, email, password, confirm_password, csrf_token } = req.body;

    // Initialize errors array
    const errors = [];

    // 1. Validate Username
    if (!username || username.length < 3 || username.length > 20) {
        errors.push('Username must be between 3 and 20 characters.');
    }

    // 2. Validate Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
        errors.push('Please provide a valid email address.');
    }

    // 3. Validate Password Complexity (Server-side enforcement)
    // Must be at least 8 chars, contain uppercase, lowercase, and number
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!password || !passwordRegex.test(password)) {
        errors.push('Password must be at least 8 characters long and contain uppercase, lowercase, and numbers.');
    }

    // 4. Validate Password Confirmation
    if (password !== confirm_password) {
        errors.push('Passwords do not match.');
    }

    // 5. Validate CSRF Token (Simulated check)
    // In production, use a library like 'csurf' and check against the session
    if (csrf_token !== 'session-generated-token') {
        errors.push('Invalid security token.');
    }

    // If there are errors, return 400 Bad Request
    if (errors.length > 0) {
        return res.status(400).json({ errors });
    }

    // Simulate Database Insertion
    // In a real app, you would hash the password here using bcrypt before saving
    const newUser = {
        id: Date.now(),
        username,
        email,
        password: 'hashed_password_placeholder' 
    };
    
    users.push(newUser);

    // Return success
    res.status(201).json({ message: 'User registered successfully' });
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});