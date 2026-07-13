require('dotenv').config();
const express = require('express');
const axios = require('axios');
const app = express();

app.get('/api/external-data', async (req, res) => {
    try {
        const apiKey = process.env.EXTERNAL_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'API configuration missing' });
        }

        const response = await axios.get('https://api.example.com/data', {
            headers: { Authorization: `Bearer ${apiKey}` }
        });

        // Filter sensitive fields (example: remove 'password' and 'token')
        const filteredData = response.data.map(item => ({
            id: item.id,
            name: item.name,
            email: item.email
            // Exclude any sensitive fields from the original response
        }));

        res.json(filteredData);
    } catch (error) {
        console.error('API request failed:', error.message);
        res.status(500).json({ error: 'Failed to fetch data' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));