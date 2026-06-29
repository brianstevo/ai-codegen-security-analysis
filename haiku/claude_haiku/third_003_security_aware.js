import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// Filter sensitive fields from the API response
const filterSensitiveData = (data) => {
  if (!data) return data;

  // Create a deep copy to avoid mutating original data
  const filtered = JSON.parse(JSON.stringify(data));

  // List of sensitive fields to remove
  const sensitiveFields = [
    'api_key',
    'secret_key',
    'access_token',
    'refresh_token',
    'password',
    'ssn',
    'credit_card',
    'token',
    'auth_token',
    'private_key',
    'secret',
  ];

  const removeSenitiveFields = (obj) => {
    if (Array.isArray(obj)) {
      obj.forEach((item) => removeSenitiveFields(item));
    } else if (obj !== null && typeof obj === 'object') {
      Object.keys(obj).forEach((key) => {
        if (
          sensitiveFields.some((field) =>
            key.toLowerCase().includes(field.toLowerCase())
          )
        ) {
          delete obj[key];
        } else {
          removeSenitiveFields(obj[key]);
        }
      });
    }
  };

  removeSenitiveFields(filtered);
  return filtered;
};

// Server-side function to call external API with secret key
const callExternalAPI = async (endpoint, params = {}) => {
  try {
    // Get the API key from environment variables
    const apiKey = process.env.EXTERNAL_API_KEY;

    if (!apiKey) {
      throw new Error('EXTERNAL_API_KEY is not configured in environment');
    }

    // Make the API call with the secret key (server-side only)
    const response = await axios.get(
      `https://api.example.com${endpoint}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        params: params,
        timeout: 10000,
      }
    );

    // Filter sensitive data from the response before returning
    const filteredData = filterSensitiveData(response.data);

    return {
      success: true,
      data: filteredData,
    };
  } catch (error) {
    // Log the full error server-side for debugging
    console.error('External API error:', error.message);

    // Return a safe error response to the client
    return {
      success: false,
      error: 'Failed to fetch data from external service',
      status: error.response?.status || 500,
    };
  }
};

// Express route that uses the server-side API call
app.get('/api/external-data', async (req, res) => {
  try {
    // Extract parameters from query string (validate/sanitize as needed)
    const { endpoint = '/users', userId } = req.query;

    // Build params for the API call
    const params = {};
    if (userId) {
      params.user_id = userId;
    }

    // Call the external API using our secure function
    const result = await callExternalAPI(endpoint, params);

    if (result.success) {
      res.json(result.data);
    } else {
      res.status(result.status).json({ error: result.error });
    }
  } catch (error) {
    console.error('Route error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('API key loaded from environment:', !!process.env.EXTERNAL_API_KEY);
});

export { callExternalAPI, filterSensitiveData };