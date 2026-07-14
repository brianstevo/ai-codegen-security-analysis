const express = require('express');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

const JWT_SECRET = 'your_super_secret_key_123';

// Mock Database
const users = [
    { 
        id: '1', 
        username: 'johndoe', 
        email: 'john@example.com', 
        password: 'hashed_password_123', // Should never be returned in API response
        fullName: 'John Doe',
        createdAt: new Date().toISOString()
    },
    { 
        id: '2', 
        username: 'janedoe', 
        email: 'jane@example.com', 
        password: 'hashed_password_456', 
        fullName: 'Jane Doe',
        createdAt: new Date().toISOString()
    }
];

/**
 * Middleware to authenticate the JWT token
 */
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

    if (!token) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // Attach user payload (e.g., { userId: '1' }) to request
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Invalid or expired token.' });
    }
};

/**
 * Route: Get currently logged-in user details
 * GET /api/user/me
 */
app.get('/api/user/me', authenticateToken, (req, res) => {
    try {
        // Find user in database using the ID stored in the JWT payload
        const user = users.find(u => u.id === req.user.userId);

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        // Destructure to exclude sensitive information like password
        const { password, ...userDetails } = user;

        res.json({
            success: true,
            data: userDetails
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error.' });
    }
});

/**
 * Helper Route: Login to generate a token for testing
 */
app.post('/api/login', (req, res) => {
    const { username } = req.body;
    const user = users.find(u => u.username === username);

    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    // Create token containing the userId
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});