const express = require('express');
const jwt = require('jsonwebtoken');
const app = express();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware to verify JWT and check admin role
const verifyAdminToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Token missing' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (decoded.role !== 'admin') {
      return res.status(401).json({ error: 'Insufficient permissions' });
    }
    
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Helper function to sanitize user data (remove sensitive fields)
const sanitizeUser = (user) => {
  const { password, token, ...safeUser } = user;
  return safeUser;
};

// Sample data store
const users = [
  { id: 1, username: 'john', email: 'john@example.com', password: 'hashed_password_1', role: 'user' },
  { id: 2, username: 'jane', email: 'jane@example.com', password: 'hashed_password_2', role: 'user' },
  { id: 3, username: 'admin', email: 'admin@example.com', password: 'hashed_password_3', role: 'admin' }
];

// Admin-only endpoint to get all users
app.get('/api/admin/users', verifyAdminToken, (req, res) => {
  // Return sanitized user data without sensitive fields
  const sanitizedUsers = users.map(sanitizeUser);
  res.json({ data: sanitizedUsers });
});

// Admin-only endpoint to get a specific user
app.get('/api/admin/users/:id', verifyAdminToken, (req, res) => {
  const user = users.find(u => u.id === parseInt(req.params.id));
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  res.json({ data: sanitizeUser(user) });
});

// Admin-only endpoint to delete a user
app.delete('/api/admin/users/:id', verifyAdminToken, (req, res) => {
  const userIndex = users.findIndex(u => u.id === parseInt(req.params.id));
  
  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const deletedUser = users.splice(userIndex, 1)[0];
  res.json({ message: 'User deleted successfully', data: sanitizeUser(deletedUser) });
});

// Admin-only endpoint to update user role
app.patch('/api/admin/users/:id/role', verifyAdminToken, (req, res) => {
  const user = users.find(u => u.id === parseInt(req.params.id));
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const { role } = req.body;
  if (!role || !['user', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  
  user.role = role;
  res.json({ message: 'User role updated', data: sanitizeUser(user) });
});

// Authentication endpoint to generate tokens for testing
app.post('/api/auth/login', express.json(), (req, res) => {
  const { username } = req.body;
  const user = users.find(u => u.username === username);
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
  
  res.json({ token, user: sanitizeUser(user) });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Testing the endpoint:');
  console.log('1. Login as admin: POST /api/auth/login with { "username": "admin" }');
  console.log('2. Use the returned token in Authorization header: Bearer <token>');
  console.log('3. Access admin endpoints like GET /api/admin/users');
});