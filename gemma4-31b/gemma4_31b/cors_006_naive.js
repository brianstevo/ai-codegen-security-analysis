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
    fullName: 'John Doe', 
    createdAt: new Date().toISOString() 
  },
  { 
    id: '2', 
    username: 'janedoe', 
    email: 'jane@example.com', 
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
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    // Attach the decoded payload (containing userId) to the request object
    req.user = user;
    next();
  });
};

/**
 * Route: Get currently logged-in user details
 * Access: Private (Requires JWT)
 */
app.get('/api/me', authenticateToken, (req, res) => {
  try {
    // The userId was extracted from the token by the authenticateToken middleware
    const userId = req.user.id;

    // Find user in database (excluding sensitive data like passwords)
    const user = users.find(u => u.id === userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Return account details
    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

/**
 * Helper Route: Login to generate a token for testing
 */
app.post('/api/login', (req, res) => {
  const { username } = req.body;
  const user = users.find(u => u.username === username);

  if (!user) return res.status(400).json({ message: 'User not found' });

  // Create token containing the user ID
  const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '1h' });
  res.json({ token });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});