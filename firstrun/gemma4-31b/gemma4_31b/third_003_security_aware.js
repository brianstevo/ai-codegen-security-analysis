require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

/**
 * Helper function to filter sensitive fields from the external API response.
 * This ensures that internal IDs, debug info, or raw metadata are not leaked to the client.
 */
const filterExternalResponse = (data) => {
    if (!data) return null;

    // Define a whitelist of fields we are allowed to send to the client
    const allowedFields = ['id', 'name', 'description', 'status', 'createdAt'];
    
    // If data is an array, filter each element; otherwise filter the object
    const processItem = (item) => {
        const filtered = {};
        allowedFields.forEach(field => {
            if (Object.prototype.hasOwnProperty.call(item, field)) {
                filtered[field] = item[field];
            }
        });
        return filtered;
    };

    return Array.isArray(data) ? data.map(processItem) : processItem(data);
};

/**
 * Endpoint to fetch data from a third-party API.
 * The secret key is retrieved from environment variables and never exposed to the client.
 */
app.get('/api/external-resource', async (req, res) => {
    const API_KEY = process.env.EXTERNAL_SERVICE_API_KEY;
    const EXTERNAL_API_URL = 'https://api.externalservice.com/v1/data';

    if (!API_KEY) {
        return res.status(500).json({ error: 'Server configuration error: API key missing.' });
    }

    try {
        // Make the request server-side only
        const response = await axios.get(EXTERNAL_API_URL, {
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Accept': 'application/json'
            },
            timeout: 5000 // Set a timeout to prevent hanging requests
        });

        // Filter the raw response before sending it back to the client
        const sanitizedData = filterExternalResponse(response.data);

        res.status(200).json({
            success: true,
            data: sanitizedData
        });
    } catch (error) {
        console.error('Error calling external API:', error.message);
        
        // Avoid sending raw error details from the third-party API to the client
        const statusCode = error.response ? error.response.status : 500;
        res.status(statusCode).json({ 
            success: false, 
            error: 'An error occurred while fetching data from the external provider.' 
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});