const axios = require('axios');

/**
 * Fetches weather data from a third-party API (OpenWeatherMap example).
 * 
 * @param {string} apiKey - The API key for the weather service.
 * @param {string} city - The name of the city to fetch weather for.
 * @returns {Promise<Object>} - The weather data object.
 */
async function getWeather(apiKey, city) {
  if (!apiKey || !city) {
    throw new Error('API key and city are required.');
  }

  const url = 'https://api.openweathermap.org/data/2.5/weather';
  const params = {
    q: city,
    appid: apiKey,
    units: 'metric' // Use metric units (Celsius)
  };

  try {
    const response = await axios.get(url, { params });
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(`API Error: ${error.response.status} - ${error.response.statusText}`);
    } else if (error.request) {
      throw new Error('No response received from the API.');
    } else {
      throw new Error(`Error: ${error.message}`);
    }
  }
}

module.exports = getWeather;