import express from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const router = express.Router();

// In-memory user store (in production, use a database)
const users = new Map();
const sessions = new Map();

// Google OAuth configuration (these would typically come from environment variables)
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Step 1: Redirect user to Google's OAuth consent screen
router.get('/google', (req, res) => {
  const state = crypto.randomBytes(32).toString('hex');
  sessions.set(state, { timestamp: Date.now() });
  
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    state: state
  });
  
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
});

// Step 2: Handle Google's OAuth callback
router.get('/google/callback', async (req, res) => {
  const { code, state, error } = req.query;
  
  // Check for errors from Google
  if (error) {
    return res.status(400).json({ error: `Google OAuth error: ${error}` });
  }
  
  // Verify state parameter to prevent CSRF attacks
  if (!state || !sessions.has(state)) {
    return res.status(400).json({ error: 'Invalid state parameter' });
  }
  
  // Remove state from sessions (one-time use)
  sessions.delete(state);
  
  if (!code) {
    return res.status(400).json({ error: 'No authorization code provided' });
  }
  
  try {
    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code'
      }).toString()
    });
    
    if (!tokenResponse.ok) {
      throw new Error(`Token exchange failed: ${tokenResponse.statusText}`);
    }
    
    const { access_token, id_token } = await tokenResponse.json();
    
    // Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    
    if (!userInfoResponse.ok) {
      throw new Error(`Failed to get user info: ${userInfoResponse.statusText}`);
    }
    
    const googleUser = await userInfoResponse.json();
    
    // Find or create user
    let user = users.get(googleUser.id);
    if (!user) {
      user = {
        id: googleUser.id,
        email: googleUser.email,
        name: googleUser.name,
        picture: googleUser.picture,
        googleId: googleUser.id,
        createdAt: new Date().toISOString()
      };
      users.set(googleUser.id, user);
    }
    
    // Generate JWT token
    const jwtToken = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // In a real app, you might redirect to frontend with token
    // res.redirect(`${FRONTEND_URL}?token=${jwtToken}`);
    
    res.json({
      success: true,
      token: jwtToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture
      }
    });
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).json({ error: 'Authentication failed', details: error.message });
  }
});

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token', details: error.message });
  }
};

// Protected route example
router.get('/user', verifyToken, (req, res) => {
  const user = users.get(req.user.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture
    }
  });
});

// Logout route (invalidate token on client side)
router.post('/logout', verifyToken, (req, res) => {
  // In a real app, you might add the token to a blacklist
  res.json({ success: true, message: 'Logged out successfully' });
});

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use('/auth', router);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Google OAuth Routes:');
  console.log(`  GET  /auth/google - Initiate Google login`);
  console.log(`  GET  /auth/google/callback - Google callback endpoint`);
  console.log(`  GET  /auth/user - Get current user (requires token)`);
  console.log(`  POST /auth/logout - Logout (requires token)`);
});

export default app;