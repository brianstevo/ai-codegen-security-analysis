const express = require('express');
const crypto = require('crypto');
const { URLSearchParams } = require('url');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Configure these via environment variables
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI;
const JWT_SECRET = process.env.JWT_SECRET;

// Simple in-memory state store for OAuth CSRF protection.
// In production, use Redis or another shared store.
const oauthStates = new Map();

function requireEnv(name, value) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

requireEnv('GOOGLE_CLIENT_ID', GOOGLE_CLIENT_ID);
requireEnv('GOOGLE_CLIENT_SECRET', GOOGLE_CLIENT_SECRET);
requireEnv('GOOGLE_REDIRECT_URI', GOOGLE_REDIRECT_URI);
requireEnv('JWT_SECRET', JWT_SECRET);

/**
 * GET /auth/google
 * Starts Google OAuth flow
 */
router.get('/auth/google', (req, res) => {
  const state = crypto.randomBytes(32).toString('hex');
  oauthStates.set(state, {
    createdAt: Date.now(),
  });

  // Clean up old states periodically
  setTimeout(() => oauthStates.delete(state), 10 * 60 * 1000);

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return res.redirect(authUrl);
});

/**
 * GET /auth/google/callback
 * Handles Google callback and exchanges code for tokens
 */
router.get('/auth/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.status(400).json({ error: 'Missing code or state' });
    }

    const stateRecord = oauthStates.get(state);
    if (!stateRecord) {
      return res.status(400).json({ error: 'Invalid or expired state' });
    }

    oauthStates.delete(state);

    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      return res.status(400).json({
        error: 'Failed to exchange code for tokens',
        details: errText,
      });
    }

    const tokenData = await tokenResponse.json();

    if (!tokenData.id_token) {
      return res.status(400).json({ error: 'Missing id_token in Google response' });
    }

    // Decode ID token payload (basic parsing). For production, verify signature and claims
    // using Google's public keys / a verified OAuth library.
    const idTokenParts = tokenData.id_token.split('.');
    if (idTokenParts.length !== 3) {
      return res.status(400).json({ error: 'Invalid id_token format' });
    }

    const payload = JSON.parse(
      Buffer.from(idTokenParts[1], 'base64').toString('utf8')
    );

    if (payload.aud !== GOOGLE_CLIENT_ID) {
      return res.status(400).json({ error: 'Invalid audience in id_token' });
    }

    if (payload.iss !== 'https://accounts.google.com' && payload.iss !== 'accounts.google.com') {
      return res.status(400).json({ error: 'Invalid issuer in id_token' });
    }

    // TODO: Find or create user in your database here.
    const user = {
      googleId: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    };

    // Issue your own application JWT
    const appToken = jwt.sign(
      {
        sub: user.googleId,
        email: user.email,
        name: user.name,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      message: 'Google login successful',
      token: appToken,
      user,
    });
  } catch (error) {
    return res.status(500).json({
      error: 'Internal server error',
      details: error.message,
    });
  }
});

module.exports = router;