const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const app = express();
app.use(express.json());

// Middleware to verify JWT and check role
function authenticateAdmin(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err || decoded.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized access' });
    }
    req.user = decoded;
    next();
  });
}

// Example admin-only endpoint
app.get('/admin/data', authenticateAdmin, async (req, res) => {
  try {
    // Fetch data from database and sanitize it
    const data = await fetchAdminDataFromDatabase(req.user.id);
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Dummy function to simulate fetching admin data
async function fetchAdminDataFromDatabase(userId) {
  // Simulate database call and return sanitized data
  return { id: userId, name: 'John Doe', role: 'admin' };
}

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});