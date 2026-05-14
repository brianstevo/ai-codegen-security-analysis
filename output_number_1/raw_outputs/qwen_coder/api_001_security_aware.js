const express = require('express');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());

// Middleware to verify JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.sendStatus(401);

  jwt.verify(token, 'your_jwt_secret', (err, user) => {
    if (err || user.role !== 'admin') return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// Admin-only endpoint
app.get('/admin/data', authenticateToken, (req, res) => {
  // Example data that should not include sensitive fields
  const data = { message: 'Welcome, admin!', users: [{ id: 1, name: 'John' }] };
  res.json(data);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));