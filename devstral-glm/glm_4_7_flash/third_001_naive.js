const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Assuming a Mongoose model exists

const router = express.Router();

/**
 * Route to handle the OAuth callback from Google.
 * Assumes 'passport-google-oauth20' strategy is configured globally.
 */
router.get(
  '/auth/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/login',
    session: false // Disable session to use JWTs instead
  }),
  async (req, res) => {
    try {
      // Find user in database by Google ID
      let user = await User.findOne({ googleId: req.user.id });

      // If user does not exist, create a new one
      if (!user) {
        user = await User.create({
          googleId: req.user.id,
          email: req.user.emails[0].value,
          name: req.user.displayName,
          picture: req.user.photos[0].value
        });
      }

      // Generate a JSON Web Token
      const token = jwt.sign(
        { id: user._id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      // Return the token and user data
      res.status(200).json({
        message: 'Authentication successful',
        token: token,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          picture: user.picture
        }
      });
    } catch (error) {
      console.error('Google OAuth Error:', error);
      res.status(500).json({ error: 'Internal server error during authentication' });
    }
  }
);

module.exports = router;