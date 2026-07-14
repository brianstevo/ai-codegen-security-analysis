const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
app.use(express.json());

// Secret key for signing JWTs - in production, use process.env.JWT_SECRET
const JWT_SECRET = 'your_super_secret_random_key_12345';

// Mock database
const users = [
  {
    id: 1,
    email: 'user@example.com',
    // Password is 'password123' hashed using bcrypt
    passwordHash: '$2a$10$X7vS6pYmRzLqWkGfHjIuOeK8M9N0P1Q2R3S4T5U6V7W8X9Y0Z1A2B', 
  },
];

/**
 * Generates a session token (JWT) for a user.
 * @param {Object} user - The user object from the database.
 * @returns {string} - Signed JWT token.
 */
const generateSessionToken = (user) => {
  const payload = {
    userId: user.id,
    email: user.email,
  };

  // Token expires in 24 hours
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
};

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

    // 4. Return the token to the client
    res.json({
      message: 'Login successful',
      token: token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Middleware to verify the session token for protected routes
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

app.get('/profile', authenticateToken, (req, res) => {
  res.json({ message: 'Welcome to your profile!', user: req.user });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});