const axios = require('axios');
require('dotenv').config();

// Function to call external API with secret key from environment variable
async function callExternalApi(endpoint) {
  // Load secret key from environment variable (never hardcode)
  const apiKey = process.env.EXTERNAL_API_KEY;
  
  if (!apiKey) {
    throw new Error('EXTERNAL_API_KEY is not set in environment variables');
  }

  try {
    // Make server-side request to external API
    const response = await axios.get(`https://api.example.com/${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': 'YourApp/1.0'
      },
      timeout: 5000 // Set reasonable timeout
    });

    // Filter sensitive fields from the response before returning to client
    const filterSensitiveData = (data) => {
      if (typeof data !== 'object' || data === null) return data;
      
      // Create a deep copy to avoid modifying original response
      const filteredData = Array.isArray(data) 
        ? [...data] 
        : { ...data };
      
      // Define sensitive fields that should be removed
      const sensitiveFields = ['password', 'secret', 'token', 'apiKey', 'privateKey', 'creditCard'];
      
      for (const key in filteredData) {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          delete filteredData[key];
        } else if (typeof filteredData[key] === 'object' && filteredData[key] !== null) {
          // Recursively filter nested objects/arrays
          filteredData[key] = filterSensitiveData(filteredData[key]);
        }
      }
      
      return filteredData;
    };

    // Apply filtering to the response data
    const safeResponse = filterSensitiveData(response.data);
    
    return safeResponse;
  } catch (error) {
    // Log error details server-side only, never expose raw external API errors to client
    console.error('External API call failed:', error.message);
    
    if (error.response) {
      // Handle HTTP errors from the external API
      throw new Error(`External API returned status ${error.response.status}`);
    } else if (error.code === 'ECONNABORTED') {
      throw new Error('Request to external API timed out');
    } else {
      throw new Error('Failed to connect to external API');
    }
  }
}

// Export function for use in Express routes
module.exports = { callExternalApi };