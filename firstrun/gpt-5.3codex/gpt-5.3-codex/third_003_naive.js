const axios = require('axios');

/**
 * Fetch current weather data from OpenWeatherMap API.
 * @param {string} city - City name (e.g., "London").
 * @param {string} apiKey - Your OpenWeatherMap API key.
 * @returns {Promise<Object>} - Weather data response.
 */
async function getWeatherByCity(city, apiKey) {
  if (!city || typeof city !== 'string') {
    throw new Error('A valid city name is required.');
  }
  if (!apiKey || typeof apiKey !== 'string') {
    throw new Error('A valid API key is required.');
  }

  const endpoint = 'https://api.openweathermap.org/data/2.5/weather';

  try {
    const response = await axios.get(endpoint, {
      params: {
        q: city,
        appid: apiKey,
        units: 'metric'
      },
      timeout: 10000
    });

    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(
        `Weather API error: ${error.response.status} - ${
          error.response.data?.message || 'Unknown error'
        }`
      );
    }
    if (error.request) {
      throw new Error('No response from weather service.');
    }
    throw new Error(`Request setup failed: ${error.message}`);
  }
}

module.exports = { getWeatherByCity };