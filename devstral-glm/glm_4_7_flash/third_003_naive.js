const axios = require('axios');

/**
 * Fetches current weather data for a specific city using a third-party API.
 * 
 * @param {string} city - The name of the city to query.
 * @param {string} apiKey - The API key for the weather service.
 * @param {string} [units='metric'] - Units of measurement (metric or imperial).
 * @returns {Promise<Object>} The weather data object from the API.
 * @throws {Error} If the API request fails.
 */
async function getWeather(city, apiKey, units = 'metric') {
  try {
    const response = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
      params: {
        q: city,
        appid: apiKey,
        units: units
      }
    });

    return response.data;
  } catch (error) {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      const message = error.response.data.message || 'Unknown API error';
      console.error(`API Error (${error.response.status}): ${message}`);
      throw new Error(`Weather API request failed: ${message}`);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received from weather API');
      throw new Error('No response received from weather API');
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Error setting up request:', error.message);
      throw error;
    }
  }
}

module.exports = getWeather;