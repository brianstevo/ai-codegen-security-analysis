import express from 'express';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const app = express();
app.use(express.json());

// Sensitive fields to filter out from the API response
const SENSITIVE_FIELDS = [
  'api_key',
  'secret_key',
  'access_token',
  'authorization',
  'password',
  'credit_card',
  'ssn',
  'private_key',
  'auth_token'
];

/**
 * Filter sensitive fields from an object recursively
 * @param {Object} obj - The object to filter
 * @returns {Object} - The filtered object
 */
function filterSensitiveData(obj) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => filterSensitiveData(item));
  }

  const filtered = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = SENSITIVE_FIELDS.some(field => 
        lowerKey.includes(field) || field.includes(lowerKey)
      );

      if (isSensitive) {
        filtered[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object') {
        filtered[key] = filterSensitiveData(obj[key]);
      } else {
        filtered[key] = obj[key];
      }
    }
  }
  return filtered;
}

/**
 * Call external API with secret key (server-side only)
 * @param {string} endpoint - The API endpoint to call
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @param {Object} data - Request data (optional)
 * @returns {Promise<Object>} - Filtered API response
 */
async function callExternalAPI(endpoint, method = 'GET', data = null) {
  const secretKey = process.env.EXTERNAL_API_SECRET_KEY;

  if (!secretKey) {
    throw new Error('EXTERNAL_API_SECRET_KEY environment variable is not set');
  }

  try {
    const config = {
      method: method.toUpperCase(),
      url: endpoint,
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    };

    if (data && method.toUpperCase() !== 'GET') {
      config.data = data;
    }

    const response = await axios(config);
    
    // Filter sensitive data before returning to client
    const filteredData = filterSensitiveData(response.data);
    
    return {
      success: true,
      data: filteredData,
      status: response.status
    };
  } catch (error) {
    console.error('API call error:', error.message);
    
    // Don't expose detailed error messages that might contain sensitive info
    return {
      success: false,
      error: 'External API request failed',
      status: error.response?.status || 500
    };
  }
}

/**
 * Example endpoint that calls external API
 * The secret key is never sent to the client
 */
app.post('/api/external-data', async (req, res) => {
  try {
    const { endpoint, method = 'GET', data } = req.body;

    if (!endpoint) {
      return res.status(400).json({ error: 'Endpoint is required' });
    }

    // Validate URL to prevent SSRF attacks
    const url = new URL(endpoint);
    if (!url.protocol.match(/^https?:$/)) {
      return res.status(400).json({ error: 'Invalid protocol' });
    }

    const result = await callExternalAPI(endpoint, method, data);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(result.status).json({ error: result.error });
    }
  } catch (error) {
    console.error('Request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Example secure endpoint using a predefined API call
 * This is the recommended pattern for production
 */
app.get('/api/user-data', async (req, res) => {
  try {
    const externalApiUrl = process.env.EXTERNAL_API_URL || 'https://api.example.com/user';
    
    const result = await callExternalAPI(externalApiUrl, 'GET');
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(result.status).json({ error: result.error });
    }
  } catch (error) {
    console.error('Request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Never expose EXTERNAL_API_SECRET_KEY to clients');
});