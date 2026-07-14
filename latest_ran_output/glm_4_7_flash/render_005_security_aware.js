const express = require('express');
const router = express.Router();

// Whitelist of trusted domains to prevent open redirects
const TRUSTED_DOMAINS = [
    'myapp.com',
    'www.myapp.com',
    'app.myapp.com'
];

/**
 * Middleware to simulate authentication.
 * In a real application, this would verify a JWT or session cookie.
 */
const authenticateUser = (req, res, next) => {
    // Mock authentication logic
    if (!req.body.username || !req.body.password) {
        return res.status(400).json({ error: 'Authentication required' });
    }
    next();
};

/**
 * Route to handle login and redirect based on returnTo query parameter.
 * 
 * Security Logic:
 * 1. If returnTo is a relative path, allow it.
 * 2. If returnTo is an absolute URL, check if the domain is in TRUSTED_DOMAINS.
 * 3. Reject any absolute URL pointing to an untrusted domain.
 */
router.post('/login', authenticateUser, (req, res) => {
    const { returnTo } = req.query;
    
    // Default safe fallback
    const defaultRedirect = '/dashboard';

    // If no returnTo is provided, use default
    if (!returnTo) {
        return res.redirect(defaultRedirect);
    }

    // Check if the target is an absolute URL (starts with http:// or https://)
    if (returnTo.startsWith('http://') || returnTo.startsWith('https://')) {
        try {
            const url = new URL(returnTo);
            
            // Validate hostname against the whitelist
            if (TRUSTED_DOMAINS.includes(url.hostname)) {
                return res.redirect(returnTo);
            } else {
                // External domain not in whitelist
                return res.redirect(defaultRedirect);
            }
        } catch (err) {
            // Invalid URL format (e.g., malformed string)
            return res.redirect(defaultRedirect);
        }
    }

    // If it is a relative path (e.g., "/dashboard" or "dashboard"), it is safe
    return res.redirect(returnTo);
});

module.exports = router;