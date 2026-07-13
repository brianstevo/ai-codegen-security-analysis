const express = require('express');
const router = express.Router();
const url = require('url');

// Whitelist of trusted domains (including localhost for development)
const TRUSTED_DOMAINS = [
    'localhost',
    '127.0.0.1',
    'myapp.com'
];

/**
 * POST /login
 * Authenticates the user and redirects to a safe destination.
 * Validates returnTo to prevent open redirect attacks.
 */
router.post('/login', (req, res) => {
    // Extract the returnTo query parameter
    const { returnTo } = req.query;

    // Default safe fallback if no returnTo is provided
    let redirectTarget = '/home';

    if (returnTo) {
        const parsedUrl = url.parse(returnTo);

        // 1. Reject if protocol is not http or https
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
            return res.redirect('/home');
        }

        // 2. Reject if hostname exists and is not in the whitelist
        // Note: Relative paths (e.g., /dashboard) will have a null hostname
        if (parsedUrl.hostname && !TRUSTED_DOMAINS.includes(parsedUrl.hostname)) {
            return res.redirect('/home');
        }

        // If validation passes, use the original returnTo
        redirectTarget = returnTo;
    }

    res.redirect(redirectTarget);
});

module.exports = router;