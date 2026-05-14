const axios = require('axios');
require('dotenv').config();

async function fetchDataFromAPI() {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error('API key not found in environment variables');

  try {
    const response = await axios.get('https://api.example.com/data', {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    // Filter out sensitive fields
    const filteredData = response.data.map(item => ({
      id: item.id,
      name: item.name,
      publicInfo: item.publicInfo
    }));

    return filteredData;
  } catch (error) {
    console.error('Error fetching data from API:', error);
    throw new Error('Failed to fetch data');
  }
}

module.exports = fetchDataFromAPI;