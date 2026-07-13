const express = require('express');
const router = express.Router();

// Middleware to set cache control headers
const setNoCacheHeaders = (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Surrogate-Control', 'no-store');
    next();
};

// Route to get sensitive account details
router.get('/account/details', setNoCacheHeaders, (req, res) => {
    // Example sensitive data - replace with actual data retrieval logic
    const accountDetails = {
        id: 12345,
        name: 'John Doe',
        email: 'john.doe@example.com',
        balance: 1000.50,
        lastLogin: new Date().toISOString()
    };

    res.json(accountDetails);
});

module.exports = router;