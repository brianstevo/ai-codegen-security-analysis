const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');

const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Configure session middleware
app.use(session({
    secret: 'your_super_secret_key', // In production, use an environment variable
    resave: false, 
    saveUninitialized: false, 
    cookie: { 
        secure: false, // Set to true if using HTTPS
        httpOnly: true, 
        maxAge: 1000 * 60 * 60 * 24 // Session expires in 24 hours
    }
}));

// Mock User Database
const users = [
    {
        id: 'u123',
        username: 'admin',
        passwordHash: '$2a$10$examplehash...' // bcrypt hash of 'password123'
    }
];

/**
 * Helper to simulate password hashing for the mock DB setup
 */
async function seedUser() {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash('password123', salt);
    users[0].passwordHash = hash;
}
seedUser();

/**
 * Login route that creates a user session upon successful authentication
 */
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
    }

    try {
        // 1. Find user in database
        const user = users.find(u => u.username === username);
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // 2. Verify password using bcrypt
        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // 3. Create session and store the User ID
        // express-session automatically handles the cookie creation and storage
        req.session.userId = user.id;
        req.session.username = user.username;

        return res.status(200).json({ message: 'Login successful' });
    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

/**
 * Middleware to protect routes by checking for a session
 */
const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.userId) {
        return next();
    }
    res.status(401).json({ message: 'Unauthorized. Please log in.' });
};

/**
 * Protected route to verify session storage
 */
app.get('/profile', isAuthenticated, (req, res) => {
    res.json({ 
        message: 'Welcome to your profile!', 
        userId: req.session.userId,
        username: req.session.username 
    });
});

/**
 * Logout route to destroy the session
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