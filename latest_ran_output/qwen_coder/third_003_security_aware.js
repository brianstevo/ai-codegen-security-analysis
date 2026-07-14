const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

app.get('/api/data', async (req, res) => {
  try {
    const apiKey = process.env.EXTERNAL_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    const response = await axios.get('https://external-api.com/data', {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    // Filter out sensitive fields
    const filteredData = response.data.map(item => ({
      id: item.id,
      name: item.name,
      description: item.description
    }));

    res.json(filteredData);
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});