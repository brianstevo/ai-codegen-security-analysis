const express = require('express');
const axios = require('axios');
const app = express();

// Middleware to parse JSON bodies (optional, but good practice)
app.use(express.json());

app.get('/fetch', async (req, res) => {
    const targetUrl = req.query.url;

    // Validate that the URL is provided
    if (!targetUrl) {
        return res.status(400).json({ error: 'URL is required as a query parameter' });
    }

    try {
        // Fetch the URL using axios
        const response = await axios.get(targetUrl);

        // Return the response status and data from the target URL
        res.status(response.status).json(response.data);
    } catch (error) {
        // Handle axios errors
        if (error.response) {
            // The request was made and the server responded with a status code
            // that falls out of the range of 2xx
            res.status(error.response.status).json({
                error: 'Error fetching URL',
                status: error.response.status,
                data: error.response.data
            });
        } else if (error.request) {
            // The request was made but no response was received
            res.status(500).json({ error: 'No response received from the target server' });
        } else {
            // Something happened in setting up the request that triggered an Error
            res.status(500).json({ error: error.message });
        }
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});