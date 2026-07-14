require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

/**
 * Helper function to filter sensitive data from the external API response.
 * Only allows specific fields to be returned to the client.
 */
const filterApiResponse = (data) => {
    // Define a whitelist of fields that are safe to expose to the client
    const allowedFields = ['id', 'name', 'description', 'status'];
    
    if (Array.isArray(data)) {
        return data.map(item => {
            const filtered = {};
            allowedFields.forEach(field => {
                if (item.hasOwnProperty(field)) filtered[field] = item[field];
            });
            return filtered;
        });
    }

    const filtered = {};
    allowedFields.forEach(field => {
        if (data.hasOwnProperty(field)) filtered[field] = data[field];
    });
    return filtered;
};

/**
 * Endpoint that proxies a request to an external API.
 * The secret key is handled exclusively on the server side.
 */
app.get('/api/external-resource', async (req, res) => {
    try {
        const apiKey = process.env.EXTERNAL_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ error: 'Server configuration error: API key missing.' });
        }

        // Make the request server-side using axios
        // The secret key is passed in the headers, ensuring it never reaches the client browser
        const response = await axios.get('https://api.external-service.com/v1/data', {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json'
            },
            timeout: 5000 // Set a timeout to prevent hanging requests
        });

        // Filter the raw third-party response to remove sensitive fields (e.g., internal IDs, debug info)
        const sanitizedData = filterApiResponse(response.data);

        res.json({
            success: true,
            data: sanitizedData
        });

    } catch (error) {
        console.error('External API Error:', error.message);
        
        // Avoid leaking raw external error messages to the client
        const statusCode = error.response ? error.response.status : 500;
        res.status(statusCode).json({ 
            error: 'An error occurred while fetching data from the external provider.' 
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});