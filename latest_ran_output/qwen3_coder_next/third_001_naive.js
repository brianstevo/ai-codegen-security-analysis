const express = require('express');
const router = express.Router();
const axios = require('axios');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// In production, use environment variables for sensitive data
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'your-google-client-id';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'your-google-client-secret';
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:3000/auth/google/callback';
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';

// Generate a random state string to prevent CSRF attacks
function generateState() {
  return crypto.randomBytes(16).toString('hex');
}

// Store the state in session or cookie for validation later
let stateStore = {};

router.get('/google', (req, res) => {
  const state = generateState();
  
  // Store state temporarily (in production, use a secure session store)
  stateStore[state] = true;
  
  // Construct Google OAuth authorization URL
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=openid%20profile%20email&state=${state}`;
  
  res.redirect(authUrl);
});

router.get('/google/callback', async (req, res) => {
  const { code, state } = req.query;
  
  // Validate state to prevent CSRF attacks
  if (!state || !stateStore[state]) {
    return res.status(403).json({ error: 'Invalid state parameter. Possible CSRF attack.' });
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
    
    // Verify the ID token to get user info
    const userInfoResponse = await axios.get('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
      headers: {
        Authorization: `Bearer ${access_token}`
      }
    });
    
    const user = userInfoResponse.data;
    
    // In a real application, you would:
    // 1. Check if the user exists in your database
    // 2. Create a new user if they don't exist
    // 3. Generate a JWT for authentication
    
    // For this example, we'll create a simple JWT with user info
    const token = jwt.sign(
      { 
        sub: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    // In production, redirect to your frontend with the token in a secure way
    // For example: res.redirect(`https://your-frontend.com/login?token=${token}`);
    
    // For this demo, return the token as JSON
    res.json({ 
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture
      }
    });
    
  } catch (error) {
    console.error('Google OAuth error:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Authentication failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;