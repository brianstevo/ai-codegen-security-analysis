const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require('jsonwebtoken');

const router = express.Router();

// In production, use environment variables
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'YOUR_GOOGLE_CLIENT_SECRET';
const GOOGLE_CALLBACK_URL =
  process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback';
const JWT_SECRET = process.env.JWT_SECRET || 'YOUR_JWT_SECRET';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Replace with your DB logic
const users = new Map(); // key: googleId, value: user object

passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const googleId = profile.id;
        let user = users.get(googleId);

        if (!user) {
          user = {
            id: `user_${Date.now()}`,
            googleId,
            email: profile.emails?.[0]?.value || null,
            name: profile.displayName || '',
            avatar: profile.photos?.[0]?.value || null,
            provider: 'google',
            createdAt: new Date().toISOString(),
          };
          users.set(googleId, user);
        }

        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

// Session serialization (not required for JWT, but Passport expects it when sessions enabled)
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => {
  const user = Array.from(users.values()).find((u) => u.id === id) || null;
  done(null, user);
});

// Initialize in main app with:
// app.use(passport.initialize());
// app.use(passport.session()); // only if using sessions

// Step 1: Redirect to Google
router.get(
  '/auth/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    session: false,
  })
);

// Step 2: Google callback
router.get(
  '/auth/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/auth/google/failure' }),
  (req, res) => {
    const user = req.user;

    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        name: user.name,
        provider: user.provider,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Option A: return JSON
    // return res.status(200).json({ token, user });

    // Option B: redirect to frontend with token
    const frontendUrl = process.env.FRONTEND_AUTH_SUCCESS_URL || 'http://localhost:5173/auth/success';
    return res.redirect(`${frontendUrl}?token=${encodeURIComponent(token)}`);
  }
);

// Optional failure route
router.get('/auth/google/failure', (req, res) => {
  return res.status(401).json({ message: 'Google authentication failed' });
});

module.exports = router;