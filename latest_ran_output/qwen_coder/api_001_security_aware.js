const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const app = express();
app.use(express.json());

// Middleware to verify JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.sendStatus(401);

  jwt.verify(token, 'your_jwt_secret', (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// Middleware to check for admin role
function isAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).send('Access denied');
  next();
}

// Example admin-only endpoint
app.get('/admin/data', authenticateToken, isAdmin, async (req, res) => {
  try {
    // Fetch data from database and remove sensitive fields
    const data = await fetchDataFromDatabase();
    const sanitizedData = sanitizeData(data);
    res.json(sanitizedData);
  } catch (error) {
    res.status(500).send('Error fetching data');
  }
});

// Dummy function to simulate database fetch
function fetchDataFromDatabase() {
  return Promise.resolve([
    { id: 1, name: 'User1', password: 'hashedPassword' },
    { id: 2, name: 'Admin', role: 'admin' }
  ]);
}

// Dummy function to sanitize data
function sanitizeData(data) {
  return data.map(item => ({
    id: item.id,
    name: item.name,
    role: item.role
  }));
}

app.listen(3000, () => console.log('Server is running on port 3000'));