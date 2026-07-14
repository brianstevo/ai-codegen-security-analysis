const express = require('express');
const router = express.Router();

// Whitelist of trusted domains for absolute URL redirects
const TRUSTED_DOMAINS = ['example.com', 'www.example.com'];

/**
 * Middleware to validate the returnTo parameter.
 * Prevents open redirect attacks by ensuring the target is either:
 * 1. A relative path (starting with /)
 * 2. An absolute URL belonging to a trusted domain in the whitelist
 */
function validateRedirectUrl(req, res, next) {
    const returnTo = req.query.returnTo;

    if (!returnTo) {
        // If no returnTo is provided, proceed to default behavior (handled in route)
        return next();
    }

    try {
        // Check if it's a relative path
        if (returnTo.startsWith('/')) {
            return next();
        }

        // If not relative, parse as absolute URL
        const parsedUrl = new URL(returnTo);

        // Validate protocol (only http/https allowed)
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            throw new Error('Invalid protocol');
        }

        // Check if the hostname is in the trusted domains whitelist
        const hostname = parsedUrl.hostname;
        if (!TRUSTED_DOMAINS.includes(hostname)) {
            throw new Error('Untrusted domain');
        }

        return next();
    } catch (error) {
        // If parsing fails or validation fails, treat as invalid
        req.query.returnTo = null;
        return next();
    }
}

/**
 * POST /login
 * Handles user login and redirects to the validated returnTo URL or default home page.
 */
router.post('/login', validateRedirectUrl, (req, res) => {
    const { username, password } = req.body;

    // Placeholder for actual authentication logic
    // In a real application, you would verify credentials against a database here
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    // Simulate successful authentication
    const isAuthenticated = true; // Replace with actual auth logic

    if (isAuthenticated) {
        // Use the validated returnTo parameter or default to home page
        const redirectUrl = req.query.returnTo || '/';
        
        // Set session or cookie here if needed
        // req.session.userId = user.id;
        
        res.redirect(redirectUrl);
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

module.exports = router;