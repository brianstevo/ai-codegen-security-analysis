const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// Mock user authentication function
function authenticateUser(username, password) {
    // Replace with actual user authentication logic
    return username === 'admin' && password === 'password';
}

// Whitelist of trusted domains
const TRUSTED_DOMAINS = ['https://example.com', 'https://trustedsite.org'];

router.get('/login', (req, res) => {
    const { username, password, returnTo } = req.query;

    if (!username || !password) {
        return res.status(400).send('Username and password are required');
    }

    if (authenticateUser(username, password)) {
        // Validate the returnTo parameter
        if (returnTo && isSafeRedirect(returnTo)) {
            return res.redirect(returnTo);
        } else {
            return res.status(403).send('Invalid redirect target');
        }
    } else {
        return res.status(401).send('Authentication failed');
    }
});

// Function to check if the URL is a safe redirect
function isSafeRedirect(url) {
    try {
        const parsedUrl = new URL(url);
        // Check if the protocol is http or https
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
            return false;
        }
        // Check if the domain is in the whitelist
        if (!TRUSTED_DOMAINS.includes(parsedUrl.origin)) {
            return false;
        }
        // Check if the path is relative or matches a trusted domain
        if (parsedUrl.pathname.startsWith('/') || TRUSTED_DOMAINS.includes(url)) {
            return true;
        }
    } catch (e) {
        return false;
    }
    return false;
}

module.exports = router;