const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

app.get('/api/data', async (req, res) => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      return res.status(500).send('API key not configured.');
    }

    const response = await axios.get('https://thirdpartyapi.com/data', {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    // Filter out sensitive fields
    const filteredData = response.data.map(item => {
      return {
        id: item.id,
        name: item.name,
        // Exclude other sensitive fields like email, address, etc.
      };
    });

    res.json(filteredData);
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).send('Failed to fetch data.');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});