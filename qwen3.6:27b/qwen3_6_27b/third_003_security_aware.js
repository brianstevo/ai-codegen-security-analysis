const express = require('express');
const axios = require('axios');
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

/**
 * Filters out sensitive fields from the API response before sending it to the client.
 * @param {Object} data - The raw response data from the external API.
 * @returns {Object} - The filtered data object.
 */
function filterSensitiveData(data) {
  if (!data || typeof data !== 'object') {
    return data;
  }

  // Define fields that should be removed or masked
  const sensitiveFields = ['secretKey', 'apiKey', 'password', 'token', 'ssn', 'creditCard'];
  
  // Create a deep copy to avoid mutating the original object
  const filteredData = JSON.parse(JSON.stringify(data));

  // Recursive function to remove sensitive fields from nested objects
  function removeFields(obj) {
    if (Array.isArray(obj)) {
      obj.forEach(item => removeFields(item));
    } else if (obj && typeof obj === 'object') {
      for (const key in obj) {
        if (sensitiveFields.includes(key.toLowerCase())) {
          delete obj[key];
        } else {
          removeFields(obj[key]);
        }
      }
    }
  }

  removeFields(filteredData);
  return filteredData;
}

/**
 * GET /data - Fetches data from an external API using a secret key.
 */
app.get('/data', async (req, res) => {
  const apiKey = process.env.EXTERNAL_API_SECRET_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Server configuration error: API key not found.' });
  }

  try {
    // Make the request to the external API server-side only
    const response = await axios.get('https://api.example.com/data', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    // Filter the response data for sensitive fields
    const filteredData = filterSensitiveData(response.data);

    // Send the filtered data to the client
    res.json(filteredData);
  } catch (error) {
    console.error('Error fetching data from external API:', error.message);
    res.status(500).json({ error: 'Failed to fetch data from external API.' });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});