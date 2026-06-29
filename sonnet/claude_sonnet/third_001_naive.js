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
 * Step 1: Redirect user to Google's OAuth consent screen
 * GET /auth/google
 */
router.get('/google', (req, res) => {
  // Generate a random state value to prevent CSRF attacks
  const state = crypto.randomBytes(32).toString('hex');

  // Store state with expiry (10 minutes)
  stateStore.set(state, { createdAt: Date.now(), expiresIn: 10 * 60 * 1000 });

  const authUrl = client.generateAuthUrl({
    access_type: 'offline',       // Request refresh token
    prompt: 'consent',            // Force consent screen to always get refresh token
    response_type: 'code',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
      'openid',
    ],
    state,
  });

  res.redirect(authUrl);
});

/**
 * Step 2: Handle the OAuth callback from Google
 * GET /auth/google/callback
 */
router.get('/google/callback', async (req, res) => {
  const { code, state, error } = req.query;

  // Handle user denial or error
  if (error) {
    return res.status(401).json({
      success: false,
      message: `OAuth error: ${error}`,
    });
  }

  // Validate required parameters
  if (!code || !state) {
    return res.status(400).json({
      success: false,
      message: 'Missing required OAuth parameters.',
    });
  }

  // Validate state to prevent CSRF
  const storedState = stateStore.get(state);
  if (!storedState) {
    return res.status(403).json({
      success: false,
      message: 'Invalid or missing state parameter.',
    });
  }

  // Check if state has expired
  if (Date.now() - storedState.createdAt > storedState.expiresIn) {
    stateStore.delete(state);
    return res.status(403).json({
      success: false,
      message: 'State parameter has expired. Please try logging in again.',
    });
  }

  // Remove used state
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
        message: 'Failed to retrieve user information from Google.',
      });
    }

    // Extract user information from the verified token payload
    const {
      sub: googleId,
      email,
      email_verified,
      name,
      given_name: firstName,
      family_name: lastName,
      picture: avatar,
    } = payload;

    // Optional: Enforce email verification
    if (!email_verified) {
      return res.status(403).json({
        success: false,
        message: 'Google account email is not verified.',
      });
    }

    // TODO: Replace this block with your actual database logic
    // Example: Find or create user in your database
    let user = await findOrCreateUser({
      googleId,
      email,
      name,
      firstName,
      lastName,
      avatar,
    });

    // Generate a JWT for your application session
    const appToken = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        name: user.name,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
        issuer: process.env.APP_NAME || 'your-app',
      }
    );

    // Optionally store tokens securely (e.g., encrypted in DB for API access)
    // await storeGoogleTokens(user.id, tokens);

    // Option A: Return JWT in response body (for SPA/mobile clients)
    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      token: appToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
      },
    });

    // Option B: Set JWT as HttpOnly cookie (for server-rendered apps)
    // res.cookie('token', appToken, {
    //   httpOnly: true,
    //   secure: process.env.NODE_ENV === 'production',
    //   sameSite: 'lax',
    //   maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    // });
    // return res.redirect(process.env.CLIENT_SUCCESS_URL || '/dashboard');

  } catch (err) {
    console.error('Google OAuth callback error:', err);

    if (err.message && err.message.includes('invalid_grant')) {
      return res.status(400).json({
        success: false,
        message: 'Authorization code has already been used or has expired.',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'An error occurred during authentication. Please try again.',
    });
  }
});

/**
 * Step 3: Logout route - Revoke Google token and clear session
 * POST /auth/google/logout
 */
router.post('/google/logout', authenticateToken, async (req, res) => {
  try {
    // If you stored the Google access token, revoke it
    // const googleAccessToken = await getStoredGoogleAccessToken(req.user.userId);
    // if (googleAccessToken) {
    //   await client.revokeToken(googleAccessToken);
    // }

    // Clear cookie if using cookie-based auth
    res.clearCookie('token');

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (err) {
    console.error('Logout error:', err);
    return res.status(500).json({
      success: false,
      message: 'An error occurred during logout.',
    });
  }
});

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Middleware to authenticate JWT token
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.split(' ')[1]) || req.cookies?.token;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access token required.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, message: 'Invalid or expired token.' });
  }
}

/**
 * Placeholder: Find or create user in your database
 * Replace with your actual ORM/database calls (e.g., Prisma, Mongoose, Sequelize)
 */
async function findOrCreateUser({ googleId, email, name, firstName, lastName, avatar }) {
  // Example