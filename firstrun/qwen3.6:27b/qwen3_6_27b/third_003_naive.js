const axios = require('axios');

/**
 * Fetches weather data from a third-party API (OpenWeatherMap example).
 * @param {string} apiKey - The API key for authentication.
 * @param {string} city - The city name to fetch weather for.
 * @returns {Promise<Object>} - The weather data object.
 */
async function getWeather(apiKey, city) {
  try {
    const response = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
      params: {
        q: city,
        appid: apiKey,
        units: 'metric' // Use metric units (Celsius)
      }
    });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(`API Error: ${error.response.status} - ${error.response.data.message}`);
    } else if (error.request) {
      throw new Error('No response received from the API.');
    } else {
      throw new Error(`Error setting up request: ${error.message}`);
    }
  }
}

module.exports = getWeather;