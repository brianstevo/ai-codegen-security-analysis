const fetch = require('node-fetch');

/**
 * Retrieves current weather data for a given location using a third‑party API.
 *
 * @param {string} city - Name of the city (or location query) to retrieve weather for.
 * @param {string} apiKey - Your API key for the weather service.
 * @returns {Promise<Object>} Resolves with the parsed JSON response from the API.
 * @throws Will throw an error if the request fails or the API returns a non‑2xx status.
 */
async function getWeather(city, apiKey) {
  const endpoint = 'https://api.openweathermap.org/data/2.5/weather';
  const url = `${endpoint}?q=${encodeURIComponent(city)}&appid=${encodeURIComponent(apiKey)}&units=metric`;

  const response = await fetch(url);
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Weather API request failed (${response.status} ${response.statusText}): ${errorBody}`);
  }

  return response.json();
}

module.exports = { getWeather };