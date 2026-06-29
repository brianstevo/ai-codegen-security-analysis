const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const router = express.Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback';
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

// In-memory store for state values (use Redis or session in production)
const stateStore = new Map();
const STATE_TTL = 10 * 60 * 1000; // 10 minutes

function cleanupExpiredStates() {
  const now = Date.now();
  for (const [state, ts] of stateStore.entries()) {
    if (now - ts > STATE_TTL) stateStore.delete(state);
  }
}

// Step 1: Redirect the user to Google's consent screen
router.get('/auth/google', (req, res) => {
  cleanupExpiredStates();

  const state = crypto.randomBytes(32).toString('hex');
  stateStore.set(state, Date.now());

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  res.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
});

// Step 2: Handle the OAuth callback from Google
router.get('/auth/google/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    return res.status(400).json({ error: `Google OAuth error: ${error}` });
  }

  if (!code) {
    return res.status(400).json({ error: 'Missing authorization code' });
  }

  // Validate state to prevent CSRF
  if (!state || !stateStore.has(state)) {
    return res.status(400).json({ error: 'Invalid or expired state parameter' });
  }
  stateStore.delete(state);

  try {
    // Exchange authorization code for tokens
    const tokenResponse = await axios.post(
      GOOGLE_TOKEN_URL,
      new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token } = tokenResponse.data;

    // Fetch the user's profile information
    const userInfoResponse = await axios.get(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const profile = userInfoResponse.data;

    if (!profile.email_verified) {
      return res.status(403).json({ error: 'Google account email is not verified' });
    }

    const user = {
      googleId: profile.sub,
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
    };

    // TODO: find or create the user in your database here
    // const dbUser = await User.findOrCreate({ googleId: user.googleId, ... });

    // Issue your own application JWT
    const token = jwt.sign(
      { sub: user.googleId, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Set the token as an httpOnly cookie and redirect
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 1000,
    });

    return res.redirect(`${FRONTEND_URL}/dashboard`);
  } catch (err) {
    const detail = err.response ? err.response.data : err.message;
    console.error('Google OAuth callback error:', detail);
    return res.status(500).json({ error: 'Authentication failed' });
  }
});

module.exports = router;