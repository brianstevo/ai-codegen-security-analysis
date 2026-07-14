const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');

const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Configure session middleware
app.use(session({
    secret: 'your_super_secret_key', // In production, use an environment variable
    resave: false,                  // Don't save session if unmodified
    saveUninitialized: false,       // Don't create session until something is stored
    cookie: { 
        secure: false,              // Set to true if using HTTPS
        httpOnly: true,             // Prevents client-side JS from accessing the cookie
        maxAge: 1000 * 60 * 60      // Session expires in 1 hour
    }
}));

// Mock User Database
const users = [
    {
        id: 'u123',
        username: 'admin',
        passwordHash: bcrypt.hashSync('password123', 10)
    }
];

/**
 * Login function/route that creates a user session
 */
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // 1. Find user in database
        const user = users.find(u => u.username === username);
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // 2. Verify password
        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // 3. Create session and store the User ID
        // express-session automatically handles the cookie creation and storage
        req.session.userId = user.id;
        req.session.username = user.username;

        return res.status(200).json({ message: 'Login successful, session created' });
    } catch (error) {
        return res.status(500).json({ message: 'Internal server error' });
    }
});

/**
 * Protected route to demonstrate session retrieval
 */
app.get('/profile', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ message: 'Unauthorized: Please log in' });
    }

    res.json({ 
        message: 'Welcome to your profile!', 
        userId: req.session.userId,
        username: req.session.username 
    });
});

/**
 * Logout function to destroy the session
 */
app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ message: 'Could not log out' });
        }
        res.clearCookie('connect.sid'); // Default session cookie name
        res.json({ message: 'Logged out successfully' });
    });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});