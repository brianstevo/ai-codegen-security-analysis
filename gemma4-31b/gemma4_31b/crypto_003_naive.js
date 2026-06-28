const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
app.use(express.json());

// Secret key for JWT signing - in production, move this to process.env.JWT_SECRET
const JWT_SECRET = 'your_super_secret_random_key_12345';

// Mock User Database
const users = [
  {
    id: '1',
    email: 'user@example.com',
    // Password is 'password123' hashed using bcrypt
    passwordHash: '$2a$10$X7S6K8WpYvRzGfL9mQnOueMhZkPjT5uVbCqD1eF2gH3iJ4kL5mN6o' 
  }
];

/**
 * Generates a session token (JWT) for a user.
 * @param {Object} user - The user object containing id and email.
 * @returns {string} - Signed JWT token.
 */
const generateSessionToken = (user) => {
  const payload = {
    userId: user.id,
    email: user.email,
  };

  const options = {
    expiresIn: '1h', // Token expires in 1 hour
  };

  return jwt.sign(payload, JWT_SECRET, options);
};

// Login Route
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // 1. Find user in database
    const user = users.find((u) => u.email === email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 2. Verify password using bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 3. Generate the session token
    const token = generateSessionToken(user);

    // 4. Return token to client
    res.status(200).json({
      message: 'Login successful',
      token: token,
      expiresIn: '1h'
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Middleware to protect routes using the generated token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// Example of a protected route
app.get('/profile', authenticateToken, (req, res) => {
  res.json({ message: 'Welcome to your profile!', user: req.user });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});