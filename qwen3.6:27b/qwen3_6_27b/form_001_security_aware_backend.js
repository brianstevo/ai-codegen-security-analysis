const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs'); // Standard for hashing passwords
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Mock database (In production, use PostgreSQL, MySQL, MongoDB, etc.)
const usersDB = [];

// Helper: Generate a simple CSRF token for demonstration
// In production, use a library like 'csurf' or session-based tokens.
let csrfTokenStore = {}; 

app.get('/api/csrf-token', (req, res) => {
    const token = crypto.randomBytes(32).toString('hex');
    // In a real app, you'd store this in the user's session
    req.sessionId = 'mock-session-id'; 
    csrfTokenStore[req.sessionId] = token;
    res.json({ token });
});

// Helper: Validate Password Complexity Server-Side
const validatePasswordComplexity = (password) => {
    if (!password || password.length < 8) return false;
    // Regex: At least one uppercase, one lowercase, one number, one special char
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return regex.test(password);
};

// Helper: Validate Email Format (Basic)
const isValidEmail = (email) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
};

// Registration Route
app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password, confirmPassword, _csrf } = req.body;

        // 1. CSRF Validation (Mocked for this example)
        // In production, verify against session token
        if (!_csrf || _csrf !== csrfTokenStore['mock-session-id']) {
            return res.status(403).json({ error: 'Invalid or missing CSRF token.' });
        }

        // 2. Server-Side Field Validation (Never trust client)
        if (!username || !email || !password || !confirmPassword) {
            return res.status(400).json({ error: 'All fields are required.' });
        }

        // Username validation
        if (typeof username !== 'string' || username.length < 3 || username.length > 20) {
            return res.status(400).json({ error: 'Username must be between 3 and 20 characters.' });
        }

        // Email validation
        if (!isValidEmail(email)) {
            return res.status(400).json({ error: 'Invalid email format.' });
        }

        // Password Match Validation
        if (password !== confirmPassword) {
            return res.status(400).json({ error: 'Passwords do not match.' });
        }

        // Password Complexity Validation
        if (!validatePasswordComplexity(password)) {
            return res.status(400).json({ 
                error: 'Password must be at least 8 characters long and contain uppercase, lowercase, number, and special character.' 
            });
        }

        // Check for existing user (Mock DB)
        const existingUser = usersDB.find(u => u.email === email || u.username === username);
        if (existingUser) {
            return res.status(409).json({ error: 'Username or email already exists.' });
        }

        // 3. Hash Password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // 4. Save User (Mock DB)
        const newUser = {
            id: crypto.randomUUID(),
            username,
            email,
            password: hashedPassword,
            createdAt: new Date()
        };
        usersDB.push(newUser);

        res.status(201).json({ message: 'User registered successfully.' });

    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ error: 'Internal server error.' });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});