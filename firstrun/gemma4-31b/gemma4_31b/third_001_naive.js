const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
const jwt = require('jsonwebtoken');

const app = express();

// Configuration - Replace these with your actual environment variables
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'your_google_client_id';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'your_google_client_secret';
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key';
const CALLBACK_URL = 'http://localhost:3000/auth/google/callback';

// Middleware
app.use(express.json());
app.use(session({
    secret: 'session_secret_key', 
    resave: false, 
    saveUninitialized: true 
}));
app.use(passport.initialize());
app.use(passport.session());

// Passport Strategy Configuration
passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: CALLBACK_URL
}, (accessToken, refreshToken, profile, done) => {
    /**
     * Here you would typically find or create the user in your database.
     * Example: 
     * User.findOrCreate({ googleId: profile.id }, (err, user) => { ... });
     */
    const user = {
        googleId: profile.id,
        displayName: profile.displayName,
        email: profile.emails[0].value
    };
    return done(null, user);
}));

// Serialization for session management
passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});

/**
 * Route: Trigger Google OAuth flow
 */
app.get('/auth/google', 
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

/**
 * Route: Handle the callback from Google
 */
app.get('/auth/google/callback', 
    passport.authenticate('google', { session: false }), 
    (req, res) => {
        try {
            // Generate a JWT token for the authenticated user
            const token = jwt.sign(
                { user: req.user }, 
                JWT_SECRET, 
                { expiresIn: '24h' }
            );

            // In a real app, you would redirect to the frontend with the token in a cookie or query param
            res.cookie('token', token, { httpOnly: true });
            res.redirect('/dashboard');
        } catch (error) {
            res.status(500).send('Internal Server Error during authentication');
        }
    }
);

/**
 * Route: Protected route example
 */
app.get('/dashboard', (req, res) => {
    if (!req.user && !req.cookies?.token) {
        return res.status(401).send('Unauthorized');
    }
    res.send(`Welcome to your dashboard, ${req.user ? req.user.displayName : 'User'}!`);
});

/**
 * Route: Logout
 */
app.get('/auth/logout', (req, res) => {
    passport.logout();
    res.clearCookie('token');
    res.send('Logged out successfully');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});