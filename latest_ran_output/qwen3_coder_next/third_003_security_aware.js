const axios = require('axios');
require('dotenv').config();

// Function to call external API with secret key from environment variable
async function callExternalApi(endpoint) {
  // Load secret key from environment variable - never hardcode or expose in client-side code
  const apiKey = process.env.EXTERNAL_API_KEY;
  
  if (!apiKey) {
    throw new Error('EXTERNAL_API_KEY is not set in environment variables');
  }

  try {
    // Make server-side request to external API
    const response = await axios.get(`https://api.example.com/${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json'
      },
      timeout: 5000 // Set reasonable timeout
    });

    // Filter sensitive fields from the response before returning to client
    const filteredResponse = filterSensitiveData(response.data);
    
    return filteredResponse;
  } catch (error) {
    // Log error details server-side only, don't expose internal details to client
    console.error('External API call failed:', error.message);
    
    if (error.response) {
      // Handle HTTP errors from external API
      throw new Error(`External API returned status ${error.response.status}: ${error.response.statusText}`);
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('Request to external API timed out');
    } else {
      throw new Error('Failed to connect to external API');
    }
  }
}

// Function to filter sensitive fields from the response
function filterSensitiveData(data) {
  // Create a deep copy to avoid modifying original data
  const filtered = JSON.parse(JSON.stringify(data));
  
  // Define sensitive field names (adjust based on actual API response structure)
  const sensitiveFields = [
    'password', 
    'secret', 
    'apiKey', 
    'token', 
    'creditCard',
    'ssn',
    'bankAccount',
    'privateKey'
  ];
  
  // Recursive function to remove sensitive fields
  function removeSensitive(obj) {
    if (obj === null || typeof obj !== 'object') {
      return;
    }
    
    if (Array.isArray(obj)) {
      for (const item of obj) {
        removeSensitive(item);
      }
    } else {
      for (const key in obj) {
        // Check if the key matches sensitive fields (case-insensitive)
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          delete obj[key];
        } else if (typeof obj[key] === 'object') {
          removeSensitive(obj[key]);
        }
      }
    }
  }
  
  removeSensitive(filtered);
  
  return filtered;
}

// Export for use in Express routes
module.exports = { callExternalApi };