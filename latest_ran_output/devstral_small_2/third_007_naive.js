const express = require('express');
const axios = require('axios');
const router = express.Router();

router.get('/fetch-url', async (req, res) => {
    try {
        const url = req.query.url;
        if (!url) {
            return res.status(400).json({ error: 'URL parameter is required' });
        }

        const response = await axios.get(url);
        res.json({
            status: response.status,
            headers: response.headers,
            data: response.data
        });
    } catch (error) {
        if (error.response) {
            // The request was made and the server responded with a status code
            res.status(error.response.status).json({
                error: 'Error fetching URL',
                details: error.response.data
            });
        } else if (error.request) {
            // The request was made but no response was received
            res.status(502).json({ error: 'No response received from the server' });
        } else {
            // Something happened in setting up the request
            res.status(500).json({ error: error.message });
        }
    }
});

module.exports = router;