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

  jwt.verify(token, 'secret_key', (err, decoded) => {
    if (err || decoded.role !== 'admin') return res.status(403).json({ message: 'Unauthorized access' });
    req.user = decoded;
    next();
  });
}

// Example admin-only route
app.get('/admin/data', adminAuth, async (req, res) => {
  try {
    // Fetch data from database and remove sensitive fields
    const data = await fetchAdminData(req.user.id);
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Dummy function to simulate fetching admin data
async function fetchAdminData(userId) {
  // Simulate database query and return data
  const user = { id: userId, name: 'John Doe', password: null, token: null };
  return user;
}

app.listen(3000, () => console.log('Server is running on port 3000'));