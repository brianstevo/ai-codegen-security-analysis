const axios = require('axios');

/**
 * Fetches current weather data for a given location using OpenWeatherMap API
 * @param {string} apiKey - Your OpenWeatherMap API key
 * @param {string} city - City name to get weather for
 * @returns {Promise<Object>} - Weather data object
 */
async function getWeatherData(apiKey, city) {
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather`;
    const params = {
      q: city,
      appid: apiKey,
      units: 'metric' // Use metric units (Celsius)
    };
    
    const response = await axios.get(url, { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching weather data:', error.message);
    throw error;
  }
}

// Example usage:
// getWeatherData('YOUR_API_KEY', 'London')
//   .then(data => console.log(data))
//   .catch(err => console.error(err));