const express = require('express');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

// Secret key for JWT (in production, use environment variables)
const JWT_SECRET = 'your-secret-key-change-this-in-production';

// Mock database of users
const users = {
  'user123': {
    id: 'user123',
    email: 'john@example.com',
    username: 'johndoe',
    firstName: 'John',
    lastName: 'Doe',
    createdAt: '2024-01-15',
    role: 'user'
  },
  'user456': {
    id: 'user456',
    email: 'jane@example.com',
    username: 'janedoe',
    firstName: 'Jane',
    lastName: 'Doe',
    createdAt: '2024-02-20',
    role: 'admin'
  }
};

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = decoded;
    next();
  });
};

// Login endpoint to generate JWT token
app.post('/login', (req, res) => {
  // In production, verify credentials against database
  const userId = 'user123'; // Simulated login
  const user = users[userId];

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  res.json({ token });
});

// Route to get current user's account details
app.get('/account', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const user = users[userId];

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Return user details (exclude sensitive information if needed)
  res.json({
    id: user.id,
    email: user.email,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    createdAt: user.createdAt,
    role: user.role
  });
});

// Route to update current user's account details
app.put('/account', authenticateToken, (req, res) => {
  const userId = req.user.id;
  const user = users[userId];

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Update allowed fields
  if (req.body.firstName) user.firstName = req.body.firstName;
  if (req.body.lastName) user.lastName = req.body.lastName;
  if (req.body.username) user.username = req.body.username;

  res.json({
    message: 'Account updated successfully',
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      createdAt: user.createdAt,
      role: user.role
    }
  });
});

// Route to get public profile (example of different endpoint)
app.get('/profile/:userId', (req, res) => {
  const user = users[req.params.userId];

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Return only public information
  res.json({
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('\nExample usage:');
  console.log('1. Get token: curl -X POST http://localhost:3000/login');
  console.log('2. Get account details: curl -H "Authorization: Bearer <token>" http://localhost:3000/account');
});