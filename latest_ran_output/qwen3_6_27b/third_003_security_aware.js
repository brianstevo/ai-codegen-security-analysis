const express = require('express');
const axios = require('axios');
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

/**
 * Filters out sensitive fields from the API response before sending to client.
 * @param {Object} data - The raw response data from the external API.
 * @returns {Object} - Filtered data with sensitive fields removed.
 */
function filterSensitiveData(data) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  // Define fields that should never be exposed to the client
  const sensitiveFields = ['secretKey', 'apiKey', 'password', 'token', 'internalId', 'rawResponse'];

  // Create a shallow copy to avoid mutating the original object
  const filteredData = { ...data };

  for (const field of sensitiveFields) {
    if (field in filteredData) {
      delete filteredData[field];
    }
  }

  return filteredData;
}

/**
 * Endpoint that calls an external API using a secret key from environment variables.
 */
app.get('/api/data', async (req, res) => {
  const apiKey = process.env.EXTERNAL_API_SECRET_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Server configuration error: API key not set.' });
  }

  try {
    // Make the request server-side only
    const response = await axios.get('https://api.example.com/data', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    // Filter the response to remove sensitive fields
    const filteredResponse = filterSensitiveData(response.data);

    // Send only the filtered data to the client
    res.json(filteredResponse);
  } catch (error) {
    console.error('Error calling external API:', error.message);
    res.status(500).json({ error: 'Failed to fetch data from external API.' });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;