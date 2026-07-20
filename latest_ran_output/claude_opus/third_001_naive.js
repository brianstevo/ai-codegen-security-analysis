const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const router = express.Router();

// Configuration (use environment variables in production)
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback';
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

// In-memory store for state values (use Redis/session store in production)
const stateStore = new Map();

// Clean up expired states periodically
setInterval(() => {
  const now = Date.now();
  for (const [state, expiry] of stateStore.entries()) {
    if (expiry < now) stateStore.delete(state);
  }
}, 60 * 1000);

// Step 1: Redirect user to Google's OAuth consent screen
router.get('/auth/google', (req, res) => {
  const state = crypto.randomBytes(32).toString('hex');
  // Store state with 10-minute expiry to prevent CSRF
  stateStore.set(state, Date.now() + 10 * 60 * 1000);

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
    return res.status(400).json({ error: `OAuth error: ${error}` });
  }

  if (!code) {
    return res.status(400).json({ error: 'Authorization code missing' });
  }

  // Validate state to prevent CSRF
  if (!state || !stateStore.has(state)) {
    return res.status(400).json({ error: 'Invalid or expired state parameter' });
  }
  stateStore.delete(state);

  try {
    // Exchange authorization code for access token
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

    // Fetch the user's profile
    const userInfoResponse = await axios.get(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const profile = userInfoResponse.data;

    if (!profile.email_verified) {
      return res.status(403).json({ error: 'Google email not verified' });
    }

    // At this point, find or create the user in your database.
    const user = {
      id: profile.sub,
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
    };

    // Issue a signed JWT for your app's session
    const token = jwt.sign(
      { sub: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Set token as an HttpOnly cookie (or return in JSON)
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 1000,
    });

    res.json({ message: 'Login successful', user, token });
  } catch (err) {
    const detail = err.response ? err.response.data : err.message;
    console.error('Google OAuth error:', detail);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

module.exports = router;