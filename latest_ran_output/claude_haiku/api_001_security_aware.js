import express from 'express';
import jwt from 'jsonwebtoken';

const app = express();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware to verify JWT and check admin role
const verifyAdminToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]; // Extract token from "Bearer <token>"
  
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
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Admin-only endpoint
app.get('/api/admin/users', verifyAdminToken, (req, res) => {
  // Mock database of users with sensitive fields
  const users = [
    {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      password: 'hashed_password_123', // Sensitive - should not be exposed
      role: 'user'
    },
    {
      id: 2,
      name: 'Jane Smith',
      email: 'jane@example.com',
      password: 'hashed_password_456', // Sensitive - should not be exposed
      role: 'admin'
    },
    {
      id: 3,
      name: 'Bob Johnson',
      email: 'bob@example.com',
      password: 'hashed_password_789', // Sensitive - should not be exposed
      role: 'user'
    }
  ];

  // Filter out sensitive fields before sending response
  const safeUsers = users.map(({ password, ...safeUser }) => safeUser);

  res.json({
    success: true,
    data: safeUsers,
    requestedBy: req.user.email
  });
});

// Another admin endpoint for detailed user info
app.get('/api/admin/user/:id', verifyAdminToken, (req, res) => {
  const userId = parseInt(req.params.id);
  
  // Mock user with sensitive fields
  const user = {
    id: userId,
    name: 'John Doe',
    email: 'john@example.com',
    role: 'user',
    password: 'hashed_password_123', // Sensitive
    refreshToken: 'refresh_token_xyz' // Sensitive
  };

  // Remove sensitive fields
  const { password, refreshToken, ...safeUser } = user;

  res.json({
    success: true,
    data: safeUser,
    lastAccessedBy: req.user.email
  });
});

// Public endpoint to generate test tokens (for demonstration only)
app.post('/api/token', (req, res) => {
  const adminToken = jwt.sign(
    { email: 'admin@example.com', role: 'admin' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const userToken = jwt.sign(
    { email: 'user@example.com', role: 'user' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  res.json({
    adminToken,
    userToken
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});