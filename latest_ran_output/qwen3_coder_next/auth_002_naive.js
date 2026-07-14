// Assuming Express.js with express-session middleware
const express = require('express');
const session = require('express-session');

// Create Express app
const app = express();

// Configure session middleware
app.use(session({
  secret: 'your-secret-key', // In production, use environment variable
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    httpOnly: true,
    maxAge: 30 * 60 * 1000 // 30 minutes
  }
}));

/**
 * Creates a user session after successful login and stores the user ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} - JSON response with success status and user info
 */
function createSession(req, res) {
  // This would typically be your login route handler
  // Example usage in a route:
  /*
  app.post('/login', (req, res) => {
    const { username, password } = req.body;
    
    // Validate credentials (example)
    if (username === 'admin' && password === 'password') {
      return createSession(req, res, { id: 1, username });
    }
    
    res.status(401).json({ error: 'Invalid credentials' });
  });
  */
  
  // Function implementation
  const login = async (req, res) => {
    try {
      // In a real application, you would validate user credentials here
      // For this example, we'll assume validation was successful and we have a user object
      const { username, password } = req.body;
      
      // Validate credentials (replace with actual authentication logic)
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
      }
      
      // Example validation - replace with database lookup
      const user = await validateUser(username, password);
      
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      // Store user ID in session
      req.session.userId = user.id;
      req.session.username = user.username;
      
      // Return success response
      return res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          username: user.username
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  };
  
  // Helper function to validate user credentials (replace with actual implementation)
  const validateUser = async (username, password) => {
    // In a real app, this would query your database
    // For demo purposes:
    if (username === 'admin' && password === 'password') {
      return { id: 1, username };
    }
    return null;
  };
  
  return login(req, res);
}

// Alternative: A standalone function that can be used in a route handler
function storeUserSession(req, userId) {
  // Store user ID in session
  req.session.userId = userId;
  // You might also store other user data if needed
  // req.session.userRole = 'admin';
}

module.exports = { createSession, storeUserSession };