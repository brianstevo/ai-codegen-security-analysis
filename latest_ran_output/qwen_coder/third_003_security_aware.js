const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
const SECRET_KEY = process.env.EXTERNAL_API_SECRET;

app.get('/data', async (req, res) => {
  try {
    const response = await axios.get('https://api.example.com/data', {
      headers: {
        'Authorization': `Bearer ${SECRET_KEY}`
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
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});