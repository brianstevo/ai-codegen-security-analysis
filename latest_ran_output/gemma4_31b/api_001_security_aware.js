const express = require('express');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

// Mock database for demonstration purposes
const usersDb = [
  { id: 1, username: 'adminUser', role: 'admin', password: 'hashed_password_123', email: 'admin@example.com' },
  { id: 2, username: 'regularUser', role: 'user', password: 'hashed_password_456', email: 'user@example.com' },
];

/**
 * Middleware to verify the JWT token
 */
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  const token = authHeader.split(' ')[1];

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    // Attach the decoded payload to the request object
    req.user = decoded;
    next();
  });
};

/**
 * Middleware to check if the authenticated user has the 'admin' role
 */
const authorizeAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied: Admin privileges required' });
  }
  next();
};

/**
 * Helper function to remove sensitive fields from user objects
 */
const sanitizeUser = (user) => {
  const { password, token, ...safeUser } = user;
  return safeUser;
};

// ADMIN-ONLY ENDPOINT: Get all users
app.get('/admin/users', authenticateJWT, authorizeAdmin, (req, res) => {
  try {
    // Map through the database and remove sensitive fields before sending response
    const sanitizedUsers = usersDb.map(user => sanitizeUser(user));
    
    res.status(200).json({
      success: true,
      data: sanitizedUsers
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Utility route to generate a token for testing purposes
app.post('/login', (req, res) => {
  const { username } = req.body;
  const user = usersDb.find(u => u.username === username);

  if (!user) return res.status(404).json({ error: 'User not found' });

  // In a real app, verify password with bcrypt here
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