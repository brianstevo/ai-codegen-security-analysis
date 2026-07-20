```javascript
import express from 'express';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const app = express();
app.use(express.json());
app.use(cookieParser());

// In-memory token store (use database in production)
const rememberMeTokens = new Map();
const users = new Map();

// Configuration
const TOKEN_EXPIRY_DAYS = 30;
const TOKEN_LENGTH = 32;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const SECURE = process.env.NODE_ENV === 'production';

// Helper function to generate random tokens
function generateToken() {
  return crypto.randomBytes(TOKEN_LENGTH).toString('hex');
}

// Helper function to hash tokens for storage
async function hashToken(token) {
  return bcrypt.hash(token, 10);
}

// Helper function to compare token with hash
async function verifyToken(token, hash) {
  return bcrypt.compare(token, hash);
}

// Initialize some test users
users.set('user1', {
  id: 'user1',
  username: 'testuser',
  password: await bcrypt.hash('password123', 10),
  email: 'test@example.com'
});

// Middleware to verify JWT token
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        return res.sendStatus(403);
      }
      req.user = user;
      next();
    });
  } else {
    res.sendStatus(401);
  }
}

// Login endpoint - issues JWT and remember-me token
app.post('/login', async (req, res) => {
  const { username, password, rememberMe } = req.body;

  // Find user by username
  let userId = null;
  let user = null;

  for (const [id, userData] of users.entries()) {
    if (userData.username === username) {
      userId = id;
      user = userData;
      break;
    }
  }

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Verify password
  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Generate JWT token
  const jwtToken = jwt.sign(
    { id: userId, username: user.username, email: user.email },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const response = {
    token: jwtToken,
    user: { id: userId, username: user.username, email: user.email }
  };

  // Handle remember-me functionality
  if (rememberMe) {
    const rememberMeToken = generateToken();
    const hashedToken = await hashToken(rememberMeToken);

    // Store the hashed token with user ID and expiry
    rememberMeTokens.set(rememberMeToken, {
      userId,
      hash: hashedToken,
      createdAt: Date.now(),
      expiresAt: Date.now() + TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    });

    // Set secure cookie with remember-me token
    res.cookie('rememberMe', rememberMeToken, {
      httpOnly: true,
      secure: SECURE,
      sameSite: 'Strict',
      maxAge: TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
      path: '/'
    });
  }

  res.json(response);
});

// Refresh token endpoint - uses remember-me token to issue new JWT
app.post('/refresh', async (req, res) => {
  const rememberMeToken = req.cookies.rememberMe;

  if (!rememberMeToken) {
    return res.status(401).json({ error: 'No remember-me token found' });
  }

  const tokenData = rememberMeTokens.get(rememberMeToken);

  if (!tokenData) {
    return res.status(401).json({ error: 'Invalid remember-me token' });
  }

  // Check if token has expired
  if (Date.now() > tokenData.expiresAt) {
    rememberMeTokens.delete(rememberMeToken);
    res.clearCookie('rememberMe');
    return res.status(401).json({ error: 'Remember-me token expired' });
  }

  // Verify token
  const isValid = await verifyToken(rememberMeToken, tokenData.hash);

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const user = users.get(tokenData.userId);

  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }

  // Generate new JWT token
  const newJwtToken = jwt.sign(
    { id: tokenData.userId, username: user.username, email: user.email },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Token rotation: Delete old token and generate new remember-me token
  rememberMeTokens.delete(rememberMeToken);

  const newRememberMeToken = generateToken();
  const newHashedToken = await hashToken(newRememberMeToken);

  rememberMeTokens.set(newRememberMeToken, {
    userId: tokenData.userId,
    hash: newHashedToken,
    createdAt: Date.now(),
    expiresAt: Date.now() + TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  });

  // Set new remember-me cookie with rotated token
  res.cookie('rememberMe', newRememberMeToken, {
    httpOnly: true,
    secure: SECURE,
    sameSite: 'Strict',
    maxAge: TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    path: '/'
  });

  res.json({
    token: newJwtToken,
    message: 'Token refreshed and rotated successfully'
  });
});

// Protected endpoint example
app.get('/profile', authenticateJWT, (req, res) => {
  const user = users.get(req.user.id);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({
    id: req.user.id,
    username: req.user.username,
    email: req.user.email
  });
});

// Logout endpoint - clears remember-me token
app.post('/logout', (req, res) => {
  const rememberMeToken = req.cookies.rememberMe;

  if (rememberMeToken) {
    rememberMeTokens.delete(rememberMeToken);
  }

  res.clearCookie('rememberMe');
  res.json({ message: 'Logged out successfully' });
});

// Cleanup expired tokens periodically (every hour)
setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [token, data] of rememberMeTokens.entries()) {
    if (now > data.expiresAt) {
      rememberMeTokens.delete(token);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    console.log(`Cleaned up ${cleanedCount} expired remember-me tokens`);
  }
}, 60 * 60 * 1000);

// Error handling middleware
app.use((err, req, res, next) => {