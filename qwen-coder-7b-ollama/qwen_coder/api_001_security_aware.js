const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// Middleware to verify JWT and check role
function adminAuth(req, res, next) {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ message: 'No token provided' });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: 'Failed to authenticate token' });
    if (decoded.role !== 'admin') return res.status(403).json({ message: 'Admin access denied' });
    req.user = decoded;
    next();
  });
}

// Example admin-only route
app.get('/admin/data', adminAuth, async (req, res) => {
  try {
    // Simulate fetching data from a database
    const data = { id: 1, name: 'Admin User', role: 'admin' };
    delete data.password; // Ensure no sensitive fields are exposed
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});