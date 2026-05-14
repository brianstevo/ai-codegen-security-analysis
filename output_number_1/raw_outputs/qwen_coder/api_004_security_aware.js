const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// Mock database
let users = [
  { id: 1, username: 'user1', email: 'user1@example.com' }
];

// Middleware to authenticate user
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token == null) return res.sendStatus(401);

  jwt.verify(token, 'secret_key', (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// Whitelist of updatable fields
const updatableFields = ['email'];

app.put('/user/:id', authenticateToken, async (req, res) => {
  const userId = parseInt(req.params.id);
  const updates = {};

  // Validate input and populate updates object
  for (let field in req.body) {
    if (updatableFields.includes(field)) {
      if (field === 'email' && !validateEmail(req.body.email)) {
        return res.status(400).send('Invalid email format');
      }
      updates[field] = req.body[field];
    }
  }

  // Ensure the authenticated user can only update their own profile
  if (req.user.id !== userId) {
    return res.sendStatus(403);
  }

  // Update user in database using parameterised query
  const sql = 'UPDATE users SET ? WHERE id = ?';
  await db.query(sql, [updates, userId], (err, result) => {
    if (err) throw err;
    res.send('Profile updated');
  });
});

// Email validation function
function validateEmail(email) {
  const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(String(email).toLowerCase());
}

// Mock database connection
const db = {
  query: (sql, values, callback) => {
    // Simulate database operation
    setTimeout(() => callback(null, { affectedRows: 1 }), 100);
  }
};

app.listen(3000, () => console.log('Server is running on port 3000'));