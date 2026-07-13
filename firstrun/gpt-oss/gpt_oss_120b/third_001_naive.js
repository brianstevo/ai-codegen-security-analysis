// googleAuthRoute.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const router = express.Router();

// ---------- CONFIG ----------
const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI, // e.g., http://localhost:3000/auth/google/callback
  JWT_SECRET,
  JWT_EXPIRES_IN = '7d',
} = process.env;

// ---------- HELPERS ----------
/**
 * Exchange authorization code for Google tokens.
 */
async function getGoogleTokens(code) {
  const url = 'https://oauth2.googleapis.com/token';
  const params = new URLSearchParams({
    code,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    redirect_uri: GOOGLE_REDIRECT_URI,
    grant_type: 'authorization_code',
  });

  const { data } = await axios.post(url, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return data; // contains access_token, id_token, refresh_token, expires_in, scope, token_type
}

/**
 * Retrieve user profile using the access token.
 */
async function getGoogleUserInfo(accessToken) {
  const { data } = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data; // contains sub, name, given_name, family_name, picture, email, email_verified, locale
}

/**
 * Generate our own JWT for the authenticated user.
 */
function generateJwt(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// ---------- MOCK USER SERVICE ----------
/**
 * Replace these with real DB calls in production.
 */
const mockUserDB = new Map(); // key: email, value: user object

async function findOrCreateUser(googleProfile) {
  const { sub: googleId, email, name, picture } = googleProfile;
  let user = mockUserDB.get(email);
  if (!user) {
    user = {
      id: `u_${Date.now()}`, // simple unique ID
      googleId,
      email,
      name,
      avatar: picture,
      createdAt: new Date(),
    };
    mockUserDB.set(email, user);
  } else {
    // optionally update profile info
    user.name = name;
    user.avatar = picture;
  }
  return user;
}

// ---------- ROUTES ----------
/**
 * Step 1 – Redirect user to Google consent screen.
 */
router.get('/auth/google', (req, res) => {
  const scope = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ].join(' ');
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope,
    access_type: 'offline', // to get refresh_token
    prompt: 'consent', // force consent screen for fresh refresh token
  });
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  res.redirect(authUrl);
});

/**
 * Step 2 – Google redirects back with ?code=...
 */
router.get('/auth/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'Missing authorization code' });

    // Exchange code for tokens
    const tokenResponse = await getGoogleTokens(code);
    const { access_token: accessToken, id_token: idToken } = tokenResponse;

    // Verify ID token (optional but recommended)
    // Here we just decode it; in production use google-auth-library to verify.
    const decodedId = jwt.decode(idToken);
    if (!decodedId || !decodedId.email) {
      return res.status(401).json({ error: 'Invalid Google ID token' });
    }

    // Get user profile
    const profile = await getGoogleUserInfo(accessToken);

    // Find or create local user record
    const user = await findOrCreateUser(profile);

    // Issue our own JWT
    const appJwt = generateJwt({
      sub: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
    });

    // Respond – you can set a cookie or redirect as needed.
    // Example: JSON response
    res.json({ token: appJwt, user });
  } catch (err) {
    console.error('Google OAuth error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

module.exports = router;