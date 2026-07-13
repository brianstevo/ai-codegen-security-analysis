const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');

router.post('/login', (req, res) => {
    const { username, password, redirectUrl } = req.body;

    // Validate credentials (replace with actual authentication logic)
    if (username === 'user' && password === 'password') {
        const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.cookie('token', token, { httpOnly: true });

        // Redirect to the provided URL or default to home
        const safeRedirectUrl = redirectUrl && isValidUrl(redirectUrl) ? redirectUrl : '/';
        return res.redirect(safeRedirectUrl);
    }

    res.status(401).json({ error: 'Invalid credentials' });
});

function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch (e) {
        return false;
    }
}

module.exports = router;