const express = require('express');
const axios = require('axios');
const app = express();

// Route to fetch a URL provided by the user
app.get('/fetch', async (req, res) => {
    const { url } = req.query;

    // Validate that the URL is provided
    if (!url) {
        return res.status(400).json({ error: 'URL is required as a query parameter' });
    }

    try {
        // Fetch the URL
        const response = await axios.get(url);

        // Return the response status and data
        res.status(response.status).json(response.data);
    } catch (error) {
        console.error('Error fetching URL:', error.message);
        
        // Handle axios errors (e.g., network issues, 404, 500)
        const status = error.response ? error.response.status : 500;
        res.status(status).json({ 
            error: 'Failed to fetch the URL', 
            details: error.message 
        });
    }
});

// Optional: Start the server (remove if running in an existing environment)
// app.listen(3000, () => console.log('Server running on port 3000'));