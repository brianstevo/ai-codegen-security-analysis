```javascript
const express = require('express');
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const client = new OAuth2Client({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: process.env.GOOGLE_REDIRECT_URI,
});

// In-memory store for OAuth state parameters (use Redis or DB in production)
const stateStore = new Map();

/**
 * Step 1: Initiate Google OAuth flow
 * GET /auth/google
 */
router.get('/google', (req, res) => {
  // Generate a random state parameter to prevent CSRF attacks
  const state = crypto.randomBytes(32).toString('hex');

  // Store state with expiry (10 minutes)
  stateStore.set(state, { createdAt: Date.now(), expiresIn: 10 * 60 * 1000 });

  const authUrl = client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    state,
    prompt: 'consent',
  });

  res.redirect(authUrl);
});

/**
 * Step 2: Handle Google OAuth callback
 * GET /auth/google/callback
 */
router.get('/google/callback', async (req, res) => {
  const { code, state, error } = req.query;

  // Handle user denial or errors from Google
  if (error) {
    return res.status(400).json({
      success: false,
      message: `OAuth error: ${error}`,
    });
  }

  if (!code || !state) {
    return res.status(400).json({
      success: false,
      message: 'Missing authorization code or state parameter',
    });
  }

  // Validate state parameter
  const storedState = stateStore.get(state);
  if (!storedState) {
    return res.status(400).json({
      success: false,
      message: 'Invalid or expired state parameter',
    });
  }

  // Check if state has expired
  if (Date.now() - storedState.createdAt > storedState.expiresIn) {
    stateStore.delete(state);
    return res.status(400).json({
      success: false,
      message: 'State parameter has expired. Please try again.',
    });
  }

  // Delete state after use (one-time use)
  stateStore.delete(state);

  try {
    // Exchange authorization code for tokens
    const { tokens } = await client.getToken(code);
    client.setCredentials(tokens);

    // Verify the ID token
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload) {
      return res.status(401).json({
        success: false,
        message: 'Failed to verify Google ID token',
      });
    }

    // Extract user information from Google's payload
    const googleUser = {
      googleId: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified,
      name: payload.name,
      firstName: payload.given_name,
      lastName: payload.family_name,
      picture: payload.picture,
      locale: payload.locale,
    };

    // Check if email is verified
    if (!googleUser.emailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Google account email is not verified',
      });
    }

    // Find or create user in your database
    // Replace this with your actual database logic
    const user = await findOrCreateUser(googleUser);

    // Generate JWT access token
    const accessToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        name: user.name,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || '1h',
        issuer: process.env.JWT_ISSUER || 'your-app',
        audience: process.env.JWT_AUDIENCE || 'your-app-users',
      }
    );

    // Generate JWT refresh token
    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_REFRESH_SECRET,
      {
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
        issuer: process.env.JWT_ISSUER || 'your-app',
        audience: process.env.JWT_AUDIENCE || 'your-app-users',
      }
    );

    // Optionally store refresh token in DB for revocation support
    await storeRefreshToken(user.id, refreshToken);

    // Set HTTP-only cookies for tokens (recommended for security)
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 1000, // 1 hour
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Redirect to frontend or return JSON response
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    // Option A: Redirect to frontend
    return res.redirect(`${frontendUrl}/dashboard`);

    // Option B: Return JSON (uncomment if building an API)
    // return res.status(200).json({
    //   success: true,
    //   message: 'Login successful',
    //   user: {
    //     id: user.id,
    //     email: user.email,
    //     name: user.name,
    //     picture: user.picture,
    //   },
    //   accessToken,
    //   refreshToken,
    // });
  } catch (err) {
    console.error('Google OAuth callback error:', err);

    if (err.message.includes('invalid_grant')) {
      return res.status(400).json({
        success: false,
        message: 'Authorization code has expired or already been used',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Authentication failed. Please try again.',
    });
  }
});

/**
 * Step 3 (Optional): Token exchange endpoint for mobile/SPA clients
 * POST /auth/google/token
 * Body: { idToken: string } — ID token obtained directly from Google Sign-In SDK
 */
router.post('/google/token', async (req, res) => {
  const { idToken } = req.body;

  if (!idToken) {
    return res.status(400).json({
      success: false,
      message: 'ID token is required',
    });
  }

  try {
    // Verify the ID token
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload) {
      return res.status(401).json({
        success: false,
        message: 'Invalid ID token',
      });
    }

    if (!payload.email_verified) {
      return res.status(403).json({
        success: false,
        message: 'Google account email is not verified',
      });
    }

    const googleUser = {
      googleId: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified,
      name: