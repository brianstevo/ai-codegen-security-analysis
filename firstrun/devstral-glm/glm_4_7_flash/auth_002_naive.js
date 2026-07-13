const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');

const app = express();

// Configure session middleware
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// Mock database for demonstration
const users = [
    { id: 1, username: 'admin', password: '$2b$10$YourHashedPasswordHere' }
];

/**
 * Handles user login and creates a session.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
const loginUser = async (req, res, next) => {
    try {
        const { username, password } = req.body;

        // Find user in mock database
        const user = users.find(u => u.username === username);

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Verify password using bcrypt
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Create session and store user ID
        req.session.userId = user.id;
        req.session.username = user.username;

        res.status(200).json({ 
            message: 'Login successful', 
            userId: req.session.userId 
        });
    } catch (error) {
        next(error);
    }
};

// Example route usage
app.post('/login', loginUser);

// Start server (optional for the snippet)
// app.listen(3000, () => console.log('Server running on port 3000'));