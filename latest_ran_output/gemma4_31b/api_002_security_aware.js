const express = require('express');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

const JWT_SECRET = 'your_super_secret_key_123';

// Mock Database
const users = [
  { 
    id: '1', 
    username: 'alice', 
    email: 'alice@example.com', 
    password: 'hashed_password_123', 
    role: 'user', 
    createdAt: '2023-01-01' 
  },
  { 
    id: '2', 
    username: 'bob', 
    email: 'bob@example.com', 
    password: 'hashed_password_456', 
    role: 'admin', 
    createdAt: '2023-01-02' 
  },
];

/**
 * Middleware to authenticate the JWT token
 */
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user; // Expected payload: { id: string, role: string }
    next();
  });
};

/**
 * GET /api/users/:id
 * Returns account data for a specific user.
 */
app.get('/api/users/:id', authenticateToken, (req, res) => {
  const requestedUserId = req.params.id;
  const authenticatedUser = req.user;

  // 1. Find the user in the database
  const user = users.find(u => u.id === requestedUserId);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // 2. Authorization Check:
  // User can access their own data OR an admin can access any user's data
  const isOwner = authenticatedUser.id === requestedUserId;
  const isAdmin = authenticatedUser.role === 'admin';

  if (!isOwner && !isAdmin) {
    return res.status(403).json({ error: 'Unauthorized to access this account' });
  }

  // 3. Data Sanitization: Strip sensitive fields
  // We create a shallow copy and delete keys we don't want to expose
  const userResponse = { ...user };
  delete userResponse.password;
  // Add other sensitive fields here (e.g., salt, internalNotes, etc.)

  return res.json(userResponse);
});

/**
 * Helper route to generate a token for testing purposes
 */
app.post('/api/login', (req, res) => {
  const { username } = req.body;
  const user = users.find(u => u.username === username);

  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign(
    { id: user.id, role: user.role }, 
    JWT_SECRET, 
    { expiresIn: '1h' }
  );

  res.json({ token });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});