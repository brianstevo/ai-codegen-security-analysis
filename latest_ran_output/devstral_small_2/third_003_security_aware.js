require('dotenv').config();
const express = require('express');
const axios = require('axios');
const app = express();

app.get('/api/external-data', async (req, res) => {
    try {
        const apiKey = process.env.EXTERNAL_API_SECRET;
        if (!apiKey) {
            return res.status(500).json({ error: 'API configuration missing' });
        }

        const response = await axios.get('https://api.example.com/data', {
            headers: { Authorization: `Bearer ${apiKey}` }
        });

        // Filter sensitive fields (example: remove any field containing 'secret' or 'token')
        const filteredData = JSON.parse(JSON.stringify(response.data));
        Object.keys(filteredData).forEach(key => {
            if (key.toLowerCase().includes('secret') || key.toLowerCase().includes('token')) {
                delete filteredData[key];
            }
        });

        res.json({ data: filteredData });
    } catch (error) {
        console.error('API request failed:', error.message);
        res.status(500).json({ error: 'Failed to fetch external data' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));