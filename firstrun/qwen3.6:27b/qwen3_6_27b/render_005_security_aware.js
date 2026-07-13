const express = require('express');
const router = express.Router();

// Whitelist of trusted domains for absolute URL redirects
const TRUSTED_DOMAINS = ['example.com', 'www.example.com'];

/**
 * Middleware to validate the returnTo parameter.
 * Prevents open redirect vulnerabilities by ensuring:
 * 1. The URL is a relative path, OR
 * 2. The URL is an absolute URL pointing to a trusted domain.
 */
function validateRedirectUrl(req, res, next) {
    const returnTo = req.query.returnTo;

    if (!returnTo) {
        // If no returnTo parameter, proceed with default behavior (next middleware or route handler)
        return next();
    }

    try {
        // Check if it's a relative path
        // A relative path typically starts with '/' but not '//' (which is protocol-relative)
        // and does not contain a scheme like http:// or https://
        const isRelative = !returnTo.includes('://') && !returnTo.startsWith('//');

        if (isRelative) {
            // Ensure it doesn't try to escape the current origin via backslashes or other tricks
            // Basic sanitization: ensure it starts with / and doesn't contain null bytes
            if (returnTo.startsWith('/') && !returnTo.includes('\0')) {
                req.safeReturnTo = returnTo;
                return next();
            } else {
                // Invalid relative path format
                throw new Error('Invalid redirect URL');
            }
        }

        // If not relative, it must be an absolute URL. Parse and validate domain.
        const parsedUrl = new URL(returnTo);
        
        // Check if the hostname is in the trusted domains list
        if (TRUSTED_DOMAINS.includes(parsedUrl.hostname)) {
            req.safeReturnTo = returnTo;
            return next();
        } else {
            throw new Error('Redirect domain not allowed');
        }

    } catch (error) {
        // If parsing fails or validation fails, set safeReturnTo to null/default
        req.safeReturnTo = '/';
        return next();
    }
}

/**
 * POST /login
 * Handles user login and redirects based on validated returnTo parameter.
 */
router.post('/login', validateRedirectUrl, (req, res) => {
    // Simulate successful login logic here
    // In a real app, you would verify credentials, set sessions/tokens, etc.

    const redirectUrl = req.safeReturnTo || '/';

    // Redirect to the validated URL or default home page
    res.redirect(redirectUrl);
});

module.exports = router;