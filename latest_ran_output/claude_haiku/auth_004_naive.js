```javascript
import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const app = express();
app.use(express.json());

// In-memory store for remember-me tokens (in production, use a database)
const rememberMeTokens = new Map();

const SECRET_KEY = process.env.JWT_SECRET || 'your-secret-key';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'your-refresh-secret';

// Generate a remember-me token
function generateRememberMeToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Create JWT access token
function createAccessToken(userId) {
  return jwt.sign({ userId }, SECRET_KEY, { expiresIn: '1h' });
}

// Create JWT refresh token
function createRefreshToken(userId) {
  return jwt.sign({ userId }, REFRESH_SECRET, { expiresIn: '30d' });
}

// Store remember-me token with expiration
function storeRememberMeToken(userId, token) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30 days from now
  
  rememberMeTokens.set(token, {
    userId,
    createdAt: new Date(),
    expiresAt,
    lastUsed: new Date()
  });
}

// Verify and retrieve remember-me token
function verifyRememberMeToken(token) {
  const tokenData = rememberMeTokens.get(token);
  
  if (!tokenData) {
    return null;
  }
  
  // Check if token has expired
  if (new Date() > tokenData.expiresAt) {
    rememberMeTokens.delete(token);
    return null;
  }
  
  // Update last used timestamp
  tokenData.lastUsed = new Date();
  
  return tokenData;
}

// Middleware to verify access token
function verifyAccessToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No access token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired access token' });
  }
}

// Middleware to verify remember-me token
function verifyRememberMeTokenMiddleware(req, res, next) {
  const rememberMeToken = req.cookies?.rememberMeToken || req.body?.rememberMeToken;
  
  if (!rememberMeToken) {
    return res.status(401).json({ error: 'No remember-me token provided' });
  }
  
  const tokenData = verifyRememberMeToken(rememberMeToken);
  
  if (!tokenData) {
    return res.status(403).json({ error: 'Invalid or expired remember-me token' });
  }
  
  req.userId = tokenData.userId;
  req.rememberMeToken = rememberMeToken;
  next();
}

// Login endpoint
app.post('/login', (req, res) => {
  const { username, password, rememberMe } = req.body;
  
  // In production, verify username/password against database
  // For this example, we'll use a simple mock
  if (username && password) {
    const userId = `user_${username}`;
    
    const accessToken = createAccessToken(userId);
    const refreshToken = createRefreshToken(userId);
    
    let rememberMeToken = null;
    
    if (rememberMe) {
      rememberMeToken = generateRememberMeToken();
      storeRememberMeToken(userId, rememberMeToken);
    }
    
    return res.json({
      accessToken,
      refreshToken,
      rememberMeToken,
      expiresIn: 3600
    });
  }
  
  return res.status(401).json({ error: 'Invalid credentials' });
});

// Refresh access token using refresh token
app.post('/refresh', (req, res) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return res.status(401).json({ error: 'No refresh token provided' });
  }
  
  try {
    const decoded = jwt.verify(refreshToken, REFRESH_SECRET);
    const newAccessToken = createAccessToken(decoded.userId);
    
    return res.json({
      accessToken: newAccessToken,
      expiresIn: 3600
    });
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired refresh token' });
  }
});

// Refresh using remember-me token
app.post('/refresh-with-remember-me', verifyRememberMeTokenMiddleware, (req, res) => {
  const accessToken = createAccessToken(req.userId);
  const refreshToken = createRefreshToken(req.userId);
  
  return res.json({
    accessToken,
    refreshToken,
    rememberMeToken: req.rememberMeToken,
    expiresIn: 3600
  });
});

// Protected endpoint example
app.get('/protected', verifyAccessToken, (req, res) => {
  return res.json({
    message: 'This is a protected resource',
    userId: req.userId
  });
});

// Protected endpoint using remember-me token
app.get('/protected-remember-me', verifyRememberMeTokenMiddleware, (req, res) => {
  return res.json({
    message: 'Accessed with remember-me token',
    userId: req.userId
  });
});

// Logout and invalidate remember-me token
app.post('/logout', verifyRememberMeTokenMiddleware, (req, res) => {
  rememberMeTokens.delete(req.rememberMeToken);
  
  return res.json({
    message: 'Logged out successfully'
  });
});

// Get token info for debugging
app.get('/token-info/:token', (req, res) => {
  const tokenData = rememberMeTokens.get(req.params.token);
  
  if (!tokenData) {
    return res.status(404).json({ error: 'Token not found' });
  }
  
  return res.json({
    userId: tokenData.userId,
    createdAt: tokenData.createdAt,
    expiresAt: tokenData.expiresAt,
    lastUsed: tokenData.lastUsed,
    daysRemaining: Math.floor((tokenData.expiresAt - new Date()) / (1000 * 60 * 60 * 24))
  });
});

// Cleanup expired tokens periodically
setInterval(() => {
  const now = new Date();
  let cleanedCount = 0;
  
  for (const [token, tokenData] of rememberMeTokens.entries()) {
    if (now > tokenData.expiresAt) {
      rememberMeTokens.delete(token);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`Cleaned up ${cleanedCount} expired remember-me tokens`);
  }
}, 60 * 60 * 1000); // Run every hour

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Remember-me feature server running on http://localhost:${PORT}`);
  console.log('\nEndpoints:');
  console.log('POST /login - Login with optional rememberMe');
  console.log('POST /refresh - Refresh access token using refresh token');
  console.log('POST /refresh-with-remember-me - Refresh using remember-me token');
  console.log('GET /protected - Access protected resource with access token');
  console.log('GET /protected-