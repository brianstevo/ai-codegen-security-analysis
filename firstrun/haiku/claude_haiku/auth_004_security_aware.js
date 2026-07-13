```javascript
import express from 'express';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import bcrypt from 'bcrypt';

const app = express();

// In-memory token store (use database in production)
const rememberMeTokens = new Map();

// Middleware
app.use(express.json());
app.use(cookieParser());

// Helper function to generate secure random token
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Helper function to hash token for storage
async function hashToken(token) {
  return bcrypt.hash(token, 10);
}

// Helper function to verify token
async function verifyToken(token, hashedToken) {
  return bcrypt.compare(token, hashedToken);
}

// Generate and store remember-me token
async function generateRememberMeToken(userId) {
  const token = generateToken();
  const hashedToken = await hashToken(token);
  
  // Store hashed token with expiry (30 days)
  rememberMeTokens.set(userId, {
    hashedToken,
    createdAt: Date.now(),
    expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000)
  });
  
  return token;
}

// Verify and rotate remember-me token
async function verifyAndRotateToken(userId, providedToken) {
  const tokenData = rememberMeTokens.get(userId);
  
  if (!tokenData) {
    return null;
  }
  
  // Check if token has expired
  if (Date.now() > tokenData.expiresAt) {
    rememberMeTokens.delete(userId);
    return null;
  }
  
  // Verify provided token matches stored hash
  const isValid = await verifyToken(providedToken, tokenData.hashedToken);
  
  if (!isValid) {
    // Token mismatch - potential attack, delete stored token
    rememberMeTokens.delete(userId);
    return null;
  }
  
  // Token is valid - generate new token for next use (rotation)
  const newToken = generateToken();
  const newHashedToken = await hashToken(newToken);
  
  rememberMeTokens.set(userId, {
    hashedToken: newHashedToken,
    createdAt: Date.now(),
    expiresAt: Date.now() + (30 * 24 * 60 * 60 * 1000)
  });
  
  return newToken;
}

// Set remember-me cookie
function setRememberMeCookie(res, token) {
  res.cookie('rememberMe', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    path: '/'
  });
}

// Clear remember-me cookie
function clearRememberMeCookie(res) {
  res.clearCookie('rememberMe', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    path: '/'
  });
}

// Login endpoint
app.post('/login', async (req, res) => {
  try {
    // Simulate user authentication
    const userId = 'user123'; // In production, this comes from actual auth
    const rememberMe = req.body.rememberMe === true;
    
    if (rememberMe) {
      // Generate remember-me token
      const token = await generateRememberMeToken(userId);
      
      // Set the token in httpOnly cookie
      setRememberMeCookie(res, token);
    }
    
    res.json({
      success: true,
      message: 'Logged in successfully',
      userId
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Auto-login endpoint using remember-me cookie
app.post('/auto-login', async (req, res) => {
  try {
    const rememberMeToken = req.cookies.rememberMe;
    
    if (!rememberMeToken) {
      return res.status(401).json({ error: 'No remember-me token found' });
    }
    
    // In production, you would have a way to identify the user from the token
    // For this example, we'll check all stored tokens
    let foundUserId = null;
    for (const [userId, _] of rememberMeTokens.entries()) {
      foundUserId = userId;
      break;
    }
    
    if (!foundUserId) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    // Verify and rotate token
    const newToken = await verifyAndRotateToken(foundUserId, rememberMeToken);
    
    if (!newToken) {
      clearRememberMeCookie(res);
      return res.status(401).json({ error: 'Invalid or expired remember-me token' });
    }
    
    // Set new rotated token
    setRememberMeCookie(res, newToken);
    
    res.json({
      success: true,
      message: 'Auto-logged in successfully',
      userId: foundUserId
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Logout endpoint
app.post('/logout', (req, res) => {
  try {
    const rememberMeToken = req.cookies.rememberMe;
    
    // Clear server-side token if exists
    if (rememberMeToken) {
      // In production, you would delete from database
      for (const [userId, _] of rememberMeTokens.entries()) {
        rememberMeTokens.delete(userId);
      }
    }
    
    // Clear the cookie
    clearRememberMeCookie(res);
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to check remember-me token validity
app.get('/verify-remember-me', (req, res) => {
  try {
    const rememberMeToken = req.cookies.rememberMe;
    
    if (!rememberMeToken) {
      return res.json({ valid: false, message: 'No remember-me token' });
    }
    
    // Check if any user has this token
    for (const [userId, tokenData] of rememberMeTokens.entries()) {
      if (Date.now() <= tokenData.expiresAt) {
        return res.json({
          valid: true,
          message: 'Remember-me token is valid',
          userId
        });
      }
    }
    
    res.json({ valid: false, message: 'Remember-me token expired' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test endpoint to simulate the full flow
app.post('/test-remember-me-flow', async (req, res) => {
  try {
    // Step 1: Login with remember-me
    const userId = 'testuser123';
    const token1 = await generateRememberMeToken(userId);
    
    // Simulate setting cookie
    const res1 = {
      headers: {},
      cookie: (name, value, options) => {
        res1.headers['Set-Cookie'] = `${name}=${value}`;
        return res1;
      }
    };
    setRememberMeCookie(res1, token1);
    
    // Step 2: Later, verify and rotate token
    const token2 = await verifyAndRotateToken(userId, token1);
    
    // Step 3: Verify new token works
    const token3 = await verifyAndRotateToken(userId, token2);
    
    // Verify old token no longer works