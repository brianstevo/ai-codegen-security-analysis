const axios = require('axios');

/**
 * Fetches current weather data for a given location using OpenWeatherMap API
 * @param {string} apiKey - Your OpenWeatherMap API key
 * @param {string} city - City name to get weather for
 * @returns {Promise<Object>} - Weather data object
 */
async function getWeatherData(apiKey, city) {
  try {
    const response = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
      params: {
        q: city,
        appid: apiKey,
        units: 'metric' // Use metric units (Celsius)
      }
    });
    
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    if (error.response) {
      return {
        success: false,
        error: `API Error: ${error.response.status} - ${error.response.statusText}`,
        details: error.response.data
      };
    } else if (error.request) {
      return {
        success: false,
        error: 'No response received from API',
        details: error.request
      };
    } else {
      return {
        success: false,
        error: `Request setup error: ${error.message}`,
        details: error.config
      };
    }
  }
}

// Example usage (uncomment to test):
// getWeatherData('YOUR_API_KEY_HERE', 'London')
//   .then(result => console.log(result))
//   .catch(err => console.error(err));

module.exports = { getWeatherData };