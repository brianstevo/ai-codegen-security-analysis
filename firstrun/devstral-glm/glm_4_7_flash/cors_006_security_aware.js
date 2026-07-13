const express = require('express');
const app = express();

/**
 * Route to retrieve sensitive account details.
 * Sets specific headers to ensure the response is never cached by browsers, proxies, or CDNs.
 */
app.get('/account/details', (req, res) => {
    // Simulated sensitive data
    const sensitiveData = {
        accountId: 'ACC-882910',
        accountNumber: '****-****-****-4291',
        balance: 15420.50,
        ssn: '***-**-9821',
        lastLogin: new Date().toISOString()
    };

    // Set headers to prevent caching at all layers
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Surrogate-Control', 'no-store');

    res.status(200).json(sensitiveData);
});

module.exports = app;