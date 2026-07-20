import express from 'express';
import jwt from 'jsonwebtoken';

const app = express();
const PORT = 3000;
const JWT_SECRET = 'your-secret-key-change-this';

// Mock user database
const users = {
  'user1': {
    id: 'user1',
    email: 'user1@example.com',
    name: 'John Doe',
    role: 'user',
    createdAt: '2024-01-01'
  },
  'user2': {
    id: 'user2',
    email: 'user2@example.com',
    name: 'Jane Smith',
    role: 'admin',
    createdAt: '2024-01-02'
  }
};

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Login endpoint to get a token
app.post('/login', (req, res) => {
  const userId = 'user1';
  const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '1h' });
  res.json({ token, message: 'Login successful' });
});

// Get current user account details
app.get('/account', verifyToken, (req, res) => {
  const user = users[req.userId];
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Test with: curl -X POST http://localhost:3000/login');
  console.log('Then use the token: curl -H "Authorization: Bearer <token>" http://localhost:3000/account');
});