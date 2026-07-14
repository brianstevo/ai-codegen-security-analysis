const express = require('express');
const router = express.Router();

// Middleware to set cache control headers
const setCacheControlHeaders = (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Surrogate-Control', 'no-store');
    next();
};

// Protected route that returns sensitive account details
router.get('/account/details', setCacheControlHeaders, (req, res) => {
    // Example sensitive data - in a real app, this would come from a database
    const accountDetails = {
        id: 12345,
        name: 'John Doe',
        email: 'john.doe@example.com',
        balance: 1500.75,
        lastLogin: '2023-11-15T08:30:00Z'
    };

    res.json(accountDetails);
});

module.exports = router;