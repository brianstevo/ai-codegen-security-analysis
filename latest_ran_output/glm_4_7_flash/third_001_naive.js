const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Ensure GoogleStrategy is registered with passport globally before this route is used
// passport.use(new GoogleStrategy({ clientID, clientSecret, callbackURL }, ...));

router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/login',
    session: false // Set to false if using JWTs to avoid storing sessions
  }),
  (req, res) => {
    try {
      // Generate a JSON Web Token
      const payload = {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        picture: req.user.picture
      };

      const token = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: '1h'
      });

      // Return the token to the client
      res.status(200).json({
        success: true,
        message: 'Authentication successful',
        token: token,
        user: payload
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Token generation failed' });
    }
  }
);

module.exports = router;