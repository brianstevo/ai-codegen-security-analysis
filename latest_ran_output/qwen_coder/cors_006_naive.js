const express = require('express');
const jwt = require('jsonwebtoken');

const app = express();

// Middleware to authenticate token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.sendStatus(401);

  jwt.verify(token, 'your_secret_key', (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// Route to get current user's account details
app.get('/api/user', authenticateToken, (req, res) => {
  // Assuming user details are stored in req.user from the token
  const userDetails = {
    id: req.user.id,
    username: req.user.username,
    email: req.user.email
  };
  res.json(userDetails);
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});