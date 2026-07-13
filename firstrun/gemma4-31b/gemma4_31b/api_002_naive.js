const express = require('express');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

const JWT_SECRET = 'your_super_secret_key';

// Mock Database
const users = [
    { id: '1', username: 'alice', email: 'alice@example.com', passwordHash: 'hashed_password_123', bio: 'Hello, I am Alice!' },
    { id: '2', username: 'bob', email: 'bob@example.com', passwordHash: 'hashed_password_456', bio: 'Bob here.' },
];

/**
 * Middleware to authenticate the request using a JWT token.
 */
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) return res.status(401).json({ error: 'Access token required' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token' });
        req.user = user; 
        next();
    });
};

/**
 * GET /api/users/:id
 * Returns account data for a specific user ID.
 * Ensures that users can only access their own data unless they are an admin.
 */
app.get('/api/users/:id', authenticateToken, (req, res) => {
    const userId = req.params.id;
    const requestingUserId = req.user.id;

    // Authorization check: Only allow the user to fetch their own data 
    // (or implement admin role check here)
    if (userId !== requestingUserId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized to access this account' });
    }

    const user = users.find(u => u.id === userId);

    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }

    // Destructure to remove sensitive data like passwordHash before sending response
    const { passwordHash, ...userData } = user;

    res.json(userData);
});

// Helper route to generate a token for testing purposes
app.post('/api/login', (req, res) => {
    const { id } = req.body; // In real app, verify credentials first
    const token = jwt.sign({ id: id, role: 'user' }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});