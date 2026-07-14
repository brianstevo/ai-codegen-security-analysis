const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Secret key for signing JWTs (in production, use environment variables)
const SECRET_KEY = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * Generates a session token (JWT) for a logged-in user.
 * 
 * @param {Object} user - The user object containing at least an id and optionally other claims.
 * @returns {string} - The signed JWT token.
 */
function generateSessionToken(user) {
  if (!user || !user.id) {
    throw new Error('Invalid user object: missing id');
  }

  // Define payload with essential user data
  const payload = {
    userId: user.id,
    username: user.username || null,
    role: user.role || 'user',
    iat: Date.now() // Issued at timestamp
  };

  // Sign the token with a secret key and set expiration (e.g., 1 hour)
  const token = jwt.sign(payload, SECRET_KEY, {
    expiresIn: '1h'
  });

  return token;
}

// Example usage in an Express route context
const express = require('express');
const router = express.Router();

router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;

    // Simulated user lookup and password verification
    // In a real app, you would query your database and verify the password using bcrypt
    const mockUser = {
      id: '12345',
      username: 'john_doe',
      role: 'admin'
    };

    // Assume password is correct for this example
    if (username === 'john_doe' && password === 'password123') {
      const token = generateSessionToken(mockUser);
      res.json({
        message: 'Login successful',
        token: token,
        user: {
          id: mockUser.id,
          username: mockUser.username,
          role: mockUser.role
        }
      });
    } else {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = { generateSessionToken, router };