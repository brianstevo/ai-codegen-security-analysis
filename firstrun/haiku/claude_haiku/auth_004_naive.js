```javascript
import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const app = express();
app.use(express.json());

// In-memory storage (replace with database in production)
const users = new Map();
const rememberTokens = new Map();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const REMEMBER_ME_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
const REMEMBER_ME_TOKEN_LENGTH = 32; // bytes for crypto random token

// Register endpoint
app.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    if (users.has(email)) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    users.set(email, { email, password: hashedPassword });
    
    res.json({ message: 'User registered successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login endpoint with remember-me option
app.post('/login', async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    const user = users.get(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Create JWT token
    const token = jwt.sign({ email, userId: email }, JWT_SECRET, { expiresIn: '24h' });
    
    let rememberMeToken = null;
    let rememberMeExpiry = null;
    
    // If remember-me is requested, create a long-lived token
    if (rememberMe) {
      rememberMeToken = crypto.randomBytes(REMEMBER_ME_TOKEN_LENGTH).toString('hex');
      rememberMeExpiry = new Date(Date.now() + REMEMBER_ME_DURATION);
      
      // Store the remember-me token
      rememberTokens.set(rememberMeToken, {
        email,
        expiresAt: rememberMeExpiry,
        createdAt: new Date()
      });
    }
    
    res.json({
      token,
      rememberMeToken,
      expiresIn: '24h',
      rememberMeExpiresAt: rememberMeExpiry
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ error: 'No authorization header' });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Middleware to verify remember-me token and refresh session
const verifyRememberMeToken = (req, res, next) => {
  const rememberMeToken = req.headers['x-remember-me-token'];
  
  if (!rememberMeToken) {
    return next(); // Not using remember-me, continue
  }
  
  const tokenData = rememberTokens.get(rememberMeToken);
  
  if (!tokenData) {
    return res.status(401).json({ error: 'Invalid remember-me token' });
  }
  
  // Check if token has expired
  if (new Date() > tokenData.expiresAt) {
    rememberTokens.delete(rememberMeToken);
    return res.status(401).json({ error: 'Remember-me token expired' });
  }
  
  // Token is valid, set user in request
  req.user = { email: tokenData.email, userId: tokenData.email };
  req.rememberMeToken = rememberMeToken;
  
  next();
};

// Protected endpoint example
app.get('/profile', verifyToken, (req, res) => {
  const user = users.get(req.user.email);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  res.json({
    email: user.email,
    message: 'Protected data accessed successfully'
  });
});

// Refresh token endpoint for remember-me users
app.post('/refresh-with-remember-me', verifyRememberMeToken, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'No valid session found' });
  }
  
  // Create new JWT token
  const newToken = jwt.sign({ email: req.user.email, userId: req.user.userId }, JWT_SECRET, { expiresIn: '24h' });
  
  // If remember-me token exists, extend its expiry
  let newRememberMeToken = null;
  let newRememberMeExpiry = null;
  
  if (req.rememberMeToken) {
    const oldTokenData = rememberTokens.get(req.rememberMeToken);
    rememberTokens.delete(req.rememberMeToken);
    
    newRememberMeToken = crypto.randomBytes(REMEMBER_ME_TOKEN_LENGTH).toString('hex');
    newRememberMeExpiry = new Date(Date.now() + REMEMBER_ME_DURATION);
    
    rememberTokens.set(newRememberMeToken, {
      email: oldTokenData.email,
      expiresAt: newRememberMeExpiry,
      createdAt: new Date()
    });
  }
  
  res.json({
    token: newToken,
    rememberMeToken: newRememberMeToken,
    expiresIn: '24h',
    rememberMeExpiresAt: newRememberMeExpiry
  });
});

// Logout endpoint
app.post('/logout', (req, res) => {
  const rememberMeToken = req.headers['x-remember-me-token'];
  
  if (rememberMeToken && rememberTokens.has(rememberMeToken)) {
    rememberTokens.delete(rememberMeToken);
  }
  
  res.json({ message: 'Logged out successfully' });
});

// Cleanup expired tokens periodically
setInterval(() => {
  const now = new Date();
  for (const [token, data] of rememberTokens.entries()) {
    if (now > data.expiresAt) {
      rememberTokens.delete(token);
    }
  }
}, 60 * 60 * 1000); // Check every hour

// Helper function for client-side remember-me implementation
function createRememberMeClient() {
  return {
    login: async (email, password, rememberMe = false) => {
      const response = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, rememberMe })
      });
      
      const data = await response.json();
      
      if (rememberMe && data.rememberMeToken) {
        localStorage.setItem('