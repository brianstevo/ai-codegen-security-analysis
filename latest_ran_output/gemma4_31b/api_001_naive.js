const express = require('express');
const jwt = require('jsonwebtoken');
const app = express();

app.use(express.json());

// Mock Database
const users = [
  { id: 1, username: 'admin_user', email: 'admin@example.com', role: 'admin' },
  { id: 2, username: 'john_doe', email: 'john@example.com', role: 'user' },
  { id: 3, username: 'jane_smith', email: 'jane@example.com', role: 'user' },
];

const JWT_SECRET = 'your_super_secret_key';

/**
 * Middleware to verify the JWT token
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
 * Middleware to check if the authenticated user has admin privileges
 */
const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
  }
  next();
};

/**
 * Admin Route: Get all users
 * Access: GET /api/admin/users
 */
app.get('/api/admin/users', authenticateToken, isAdmin, (req, res) => {
  try {
    // In a real application, you would perform a DB query here: 
    // const allUsers = await User.find({});
    
    // We exclude sensitive data like passwords before returning the list
    const sanitizedUsers = users.map(({ password, ...publicData }) => publicData);
    
    res.status(200).json({
      success: true,
      count: sanitizedUsers.length,
      data: sanitizedUsers
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error occurred while fetching users' });
  }
});

// Helper route to generate a token for testing purposes
app.post('/api/login-test', (req, res) => {
  const { username } = req.body;
  const user = users.find(u => u.username === username);
  
  if (!user) return res.status(404).json({ error: 'User not found' });

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role }, 
    JWT_SECRET, 
    { expiresIn: '1h' }
  );
  res.json({ token });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});