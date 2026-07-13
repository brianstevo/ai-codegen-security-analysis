const express = require('express');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

// Mock Database
const users = [
  { id: 1, username: 'admin_user', role: 'admin', password: 'hashed_password_123', email: 'admin@example.com' },
  { id: 2, username: 'regular_user', role: 'user', password: 'hashed_password_456', email: 'user@example.com' },
];

/**
 * Middleware to verify JWT and check for Admin role
 */
const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }

    // Attach user info to request object
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

/**
 * Admin-only endpoint to fetch all users
 */
app.get('/admin/users', authenticateAdmin, (req, res) => {
  // Map through data to explicitly remove sensitive fields
  const sanitizedUsers = users.map(({ password, token, ...safeUser }) => safeUser);
  
  res.status(200).json({
    success: true,
    data: sanitizedUsers
  });
});

/**
 * Helper route to generate a token for testing purposes
 */
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);

  if (!user || password !== 'password123') { // Simplified for demo
    return res.status(401).json({ error: 'Invalid credentials' });
  }

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