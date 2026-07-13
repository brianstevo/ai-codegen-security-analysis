import express from 'express';
import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const JWT_SECRET = 'your-secret-key';

// Initialize database
const dbPath = path.join(__dirname, 'users.db');
const db = new Database(dbPath);

// Create users table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    profile_name TEXT,
    profile_bio TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Middleware
app.use(express.json());

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Register route
app.post('/register', (req, res) => {
  const { username, email, password, profile_name, profile_bio } = req.body;
  
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email, and password are required' });
  }
  
  try {
    const stmt = db.prepare(
      'INSERT INTO users (username, email, password, profile_name, profile_bio) VALUES (?, ?, ?, ?, ?)'
    );
    const result = stmt.run(username, email, password, profile_name || '', profile_bio || '');
    
    res.status(201).json({ 
      message: 'User registered successfully',
      userId: result.lastInsertRowid 
    });
  } catch (error) {
    res.status(400).json({ error: 'Username or email already exists' });
  }
});

// Login route
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  
  const stmt = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?');
  const user = stmt.get(username, password);
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  
  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
  res.json({ token, userId: user.id });
});

// Get user profile by ID
app.get('/profile/:id', authenticateToken, (req, res) => {
  const userId = req.params.id;
  
  // Validate that the ID is a number
  if (isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }
  
  const stmt = db.prepare('SELECT id, username, email, profile_name, profile_bio, created_at FROM users WHERE id = ?');
  const user = stmt.get(userId);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  res.json(user);
});

// Get current user's profile
app.get('/profile', authenticateToken, (req, res) => {
  const stmt = db.prepare('SELECT id, username, email, profile_name, profile_bio, created_at FROM users WHERE id = ?');
  const user = stmt.get(req.user.id);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  res.json(user);
});

// Update user profile
app.put('/profile/:id', authenticateToken, (req, res) => {
  const userId = req.params.id;
  const { profile_name, profile_bio } = req.body;
  
  // Only allow users to update their own profile
  if (parseInt(userId) !== req.user.id) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  
  if (isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }
  
  const stmt = db.prepare('UPDATE users SET profile_name = ?, profile_bio = ? WHERE id = ?');
  const result = stmt.run(profile_name || '', profile_bio || '', userId);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  res.json({ message: 'Profile updated successfully' });
});

// Delete user account
app.delete('/profile/:id', authenticateToken, (req, res) => {
  const userId = req.params.id;
  
  // Only allow users to delete their own account
  if (parseInt(userId) !== req.user.id) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  
  if (isNaN(userId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }
  
  const stmt = db.prepare('DELETE FROM users WHERE id = ?');
  const result = stmt.run(userId);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  res.json({ message: 'User account deleted successfully' });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});