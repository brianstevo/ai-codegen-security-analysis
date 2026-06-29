const express = require('express');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const app = express();

// Initialize SQLite database
const db = new sqlite3.Database(':memory:');

// Create users table for demo
db.run(`
  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    username TEXT,
    email TEXT,
    bio TEXT,
    is_public INTEGER DEFAULT 0
  )
`);

// Insert sample data
db.run("INSERT INTO users VALUES (1, 'john', 'john@example.com', 'Software developer', 1)");
db.run("INSERT INTO users VALUES (2, 'jane', 'jane@example.com', 'Designer', 1)");
db.run("INSERT INTO users VALUES (3, 'private', 'private@example.com', 'Private user', 0)");

// Middleware
app.use(express.json());

// JWT Secret (should be in environment variable in production)
const JWT_SECRET = 'your-secret-key-change-in-production';

// Middleware to verify JWT token and extract user info
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Validate positive integer middleware
const validatePositiveInteger = (paramName) => {
  return (req, res, next) => {
    const value = req.params[paramName];
    const id = parseInt(value, 10);
    
    if (isNaN(id) || id <= 0) {
      return res.status(400).json({ 
        error: `Invalid ${paramName}: must be a positive integer` 
      });
    }
    
    req.params[paramName] = id;
    next();
  };
};

// GET /api/users/:id - Fetch user profile by ID
app.get('/api/users/:id', 
  authMiddleware,
  validatePositiveInteger('id'),
  (req, res) => {
    const requestedUserId = req.params.id;
    const requestingUserId = req.user.id;
    
    // Query to get user data using parameterized query
    const query = 'SELECT id, username, email, bio, is_public FROM users WHERE id = ?';
    
    db.get(query, [requestedUserId], (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Authorization logic
      const isOwnProfile = requestingUserId === user.id;
      const isPublicProfile = user.is_public === 1;
      
      // Allow access if:
      // 1. It's the user's own profile
      // 2. The profile is public
      if (!isOwnProfile && !isPublicProfile) {
        return res.status(403).json({ 
          error: 'You do not have permission to view this profile' 
        });
      }
      
      // Return user profile (excluding sensitive data if not own profile)
      const responseData = {
        id: user.id,
        username: user.username,
        bio: user.bio
      };
      
      // Only include email if viewing own profile
      if (isOwnProfile) {
        responseData.email = user.email;
      }
      
      res.json(responseData);
    });
  }
);

// POST /api/auth/login - Generate JWT token for testing
app.post('/api/auth/login', (req, res) => {
  const userId = req.body.userId;
  
  if (!userId || isNaN(userId) || userId <= 0) {
    return res.status(400).json({ error: 'Invalid userId' });
  }
  
  const token = jwt.sign(
    { id: parseInt(userId, 10) },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
  
  res.json({ token });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('API ready for testing');
});

// Export for testing
module.exports = app;