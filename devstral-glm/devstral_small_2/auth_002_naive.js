const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Session configuration
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// Mock user database (in a real app, use a proper database)
const users = [
    {
        id: 1,
        username: 'testuser',
        password: '$2b$10$XBvf0NqGBP8o7lJMh4Zm9u5QZ2C3xY6y7z8A9B0C1D2E3F4G5H6I7J8K9L0' // bcrypt hash of 'password'
    }
];

// Login route
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    // Find user in database
    const user = users.find(u => u.username === username);
    if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Compare passwords
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
        return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Create session and store user ID
    req.session.userId = user.id;

    res.json({ message: 'Login successful', userId: user.id });
});

// Protected route example
app.get('/profile', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    res.json({ message: `Welcome to your profile, User ${req.session.userId}` });
});

// Logout route
app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ message: 'Could not log out' });
        }
        res.json({ message: 'Logged out successfully' });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));