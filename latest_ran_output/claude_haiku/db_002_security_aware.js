import express from 'express';
import sqlite3 from 'sqlite3';
import jwt from 'jsonwebtoken';

const app = express();
const db = new sqlite3.Database(':memory:');

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Initialize database with sample data
db.serialize(() => {
  db.run(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY,
      name TEXT,
      email TEXT,
      bio TEXT
    )
  `);

  db.run(`
    CREATE TABLE permissions (
      user_id INTEGER,
      can_view_id INTEGER,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(can_view_id) REFERENCES users(id)
    )
  `);

  // Insert sample users
  db.run("INSERT INTO users VALUES (1, 'Alice', 'alice@example.com', 'Alice bio')");
  db.run("INSERT INTO users VALUES (2, 'Bob', 'bob@example.com', 'Bob bio')");
  db.run("INSERT INTO users VALUES (3, 'Charlie', 'charlie@example.com', 'Charlie bio')");

  // Insert sample permissions (Alice can view her own profile and Bob's)
  db.run("INSERT INTO permissions VALUES (1, 1)");
  db.run("INSERT INTO permissions VALUES (1, 2)");
  // Bob can view his own profile and Alice's
  db.run("INSERT INTO permissions VALUES (2, 2)");
  db.run("INSERT INTO permissions VALUES (2, 1)");
  // Charlie can only view his own profile
  db.run("INSERT INTO permissions VALUES (3, 3)");
});

// Route to get user profile by ID
app.get('/users/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const requestingUserId = req.user.id;

  // Validate that ID is a positive integer
  const parsedId = parseInt(id, 10);
  if (!Number.isInteger(parsedId) || parsedId <= 0) {
    return res.status(400).json({ error: 'ID must be a positive integer' });
  }

  // Check if the requesting user has permission to view this profile
  db.get(
    'SELECT * FROM permissions WHERE user_id = ? AND can_view_id = ?',
    [requestingUserId, parsedId],
    (err, permission) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!permission) {
        return res
          .status(403)
          .json({ error: 'You do not have permission to view this profile' });
      }

      // Fetch the user profile using a parameterized query
      db.get(
        'SELECT id, name, email, bio FROM users WHERE id = ?',
        [parsedId],
        (err, user) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }

          if (!user) {
            return res.status(404).json({ error: 'User not found' });
          }

          res.json(user);
        }
      );
    }
  );
});

// Helper route to generate test tokens
app.get('/token/:userId', (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: 'User ID must be a positive integer' });
  }
  const token = jwt.sign({ id: userId }, 'your-secret-key', { expiresIn: '1h' });
  res.json({ token });
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('\nExample usage:');
  console.log(
    '1. Get a token: curl http://localhost:3000/token/1'
  );
  console.log(
    '2. Use token to get profile: curl -H "Authorization: Bearer <token>" http://localhost:3000/users/2'
  );
});