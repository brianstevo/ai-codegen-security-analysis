const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// In production, use environment variables for sensitive data
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:3000/auth/google/callback';
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

// Generate a random state string for CSRF protection
function generateState() {
  return crypto.randomBytes(16).toString('hex');
}

// Store the state in session (in production, use a proper session store)
let stateStore = {};

// Route to redirect user to Google's OAuth consent screen
router.get('/google', (req, res) => {
  const state = generateState();
  
  // Store state for CSRF protection (in production, use session storage)
  stateStore[state] = true;
  
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=openid%20profile%20email&state=${state}`;
  
  res.redirect(authUrl);
});

// Callback route for Google to redirect users after authentication
router.get('/google/callback', async (req, res) => {
  const { code, state } = req.query;
  
  // Verify state matches the one we stored (CSRF protection)
  if (!state || !stateStore[state]) {
    return res.status(403).json({ error: 'Invalid state parameter' });
  }
  
  try {
    // Exchange authorization code for access token
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code'
    });
    
    const { access_token, id_token } = tokenResponse.data;
    
    // Verify the ID token and get user info
    const userInfoResponse = await axios.get('https://www.googleapis.com/oauth2/v1/userinfo', {
      params: { alt: 'json' },
      headers: { Authorization: `Bearer ${access_token}` }
    });
    
    const userInfo = userInfoResponse.data;
    
    // In a real application, you would:
    // 1. Check if user exists in your database
    // 2. Create user if they don't exist
    // 3. Generate JWT token for the authenticated user
    
    // For this example, we'll create a simple JWT with user info
    const token = jwt.sign(
      { 
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    // In production, you might redirect to your frontend with the token as a query parameter
    // or set it as an HTTP-only cookie
    res.json({ 
      success: true, 
      token,
      user: {
        id: userInfo.id,
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture
      }
    });
    
  } catch (error) {
    console.error('Google OAuth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

module.exports = router;