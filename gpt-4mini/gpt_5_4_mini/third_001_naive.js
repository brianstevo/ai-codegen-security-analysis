const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Environment variables expected:
// GOOGLE_CLIENT_ID
// GOOGLE_CLIENT_SECRET
// GOOGLE_REDIRECT_URI
// JWT_SECRET
// FRONTEND_SUCCESS_REDIRECT_URL (optional)

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
  JWT_SECRET,
  FRONTEND_SUCCESS_REDIRECT_URL = 'http://localhost:3000/auth/success',
} = process.env;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI || !JWT_SECRET) {
  throw new Error(
    'Missing required environment variables: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, JWT_SECRET'
  );
}

// In-memory state store for demo purposes.
// Replace with Redis/DB in production.
const oauthStateStore = new Map();

function base64UrlEncode(buffer) {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function generateState() {
  return base64UrlEncode(crypto.randomBytes(32));
}

function generateGoogleAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// Step 1: Redirect user to Google consent screen
router.get('/auth/google', (req, res) => {
  const state = generateState();
  oauthStateStore.set(state, {
    createdAt: Date.now(),
    ip: req.ip,
    userAgent: req.get('user-agent') || '',
  });

  // Optional cleanup after 10 minutes
  setTimeout(() => oauthStateStore.delete(state), 10 * 60 * 1000).unref?.();

  const authUrl = generateGoogleAuthUrl(state);
  return res.redirect(authUrl);
});

// Step 2: Google redirects back here with ?code=...&state=...
router.get('/auth/google/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;

    if (error) {
      return res.status(400).json({ error: 'Google OAuth error', details: error });
    }

    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state' });
    }

    const storedState = oauthStateStore.get(state);
    if (!storedState) {
      return res.status(400).json({ error: 'Invalid or expired state' });
    }

    oauthStateStore.delete(state);

    // Exchange authorization code for tokens
    const tokenResponse = await axios.post(
      'https://oauth2.googleapis.com/token',
      new URLSearchParams({
        code: String(code),
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    const { id_token, access_token } = tokenResponse.data;

    if (!id_token) {
      return res.status(400).json({ error: 'No id_token returned by Google' });
    }

    // Fetch user info from Google
    const userInfoResponse = await axios.get('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    const googleUser = userInfoResponse.data;
    const { sub: googleId, email, email_verified, name, picture } = googleUser;

    if (!googleId || !email) {
      return res.status(400).json({ error: 'Incomplete Google profile data' });
    }

    // TODO: Replace with DB lookup / upsert
    // Example user object
    const user = {
      id: googleId,
      email,
      name,
      picture,
      provider: 'google',
      emailVerified: !!email_verified,
    };

    // Issue your own app JWT
    const appToken = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        provider: user.provider,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // You can also set an HTTP-only cookie here if preferred
    // res.cookie('token', appToken, { httpOnly: true, secure: true, sameSite: 'lax' });

    // Redirect to frontend with token (or return JSON)
    const redirectUrl = new URL(FRONTEND_SUCCESS_REDIRECT_URL);
    redirectUrl.searchParams.set('token', appToken);

    return res.redirect(redirectUrl.toString());
  } catch (err) {
    const status = err.response?.status || 500;
    const data = err.response?.data || err.message || 'Internal server error';
    return res.status(status).json({
      error: 'Google OAuth callback failed',
      details: data,
    });
  }
});

module.exports = router;