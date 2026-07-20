const axios = require('axios');

/**
 * Fetches current weather data for a given city from a third-party weather API.
 *
 * The API key is read from an environment variable (process.env.WEATHER_API_KEY)
 * so it never gets hard-coded into source control.
 *
 * @param {string} city - The name of the city to fetch weather for.
 * @param {object} [options] - Optional settings.
 * @param {string} [options.units='metric'] - Units of measurement ('metric', 'imperial', 'standard').
 * @param {number} [options.timeout=5000] - Request timeout in milliseconds.
 * @returns {Promise<object>} Resolves with normalized weather data.
 * @throws {Error} If the API key is missing, the city is invalid, or the request fails.
 */
async function getWeather(city, options = {}) {
  const { units = 'metric', timeout = 5000 } = options;

  const apiKey = process.env.WEATHER_API_KEY;
  if (!apiKey) {
    throw new Error('Missing WEATHER_API_KEY environment variable.');
  }

  if (typeof city !== 'string' || city.trim().length === 0) {
    throw new Error('A valid city name must be provided.');
  }

  const baseUrl = 'https://api.openweathermap.org/data/2.5/weather';

  try {
    const response = await axios.get(baseUrl, {
      params: {
        q: city.trim(),
        units,
        appid: apiKey,
      },
      timeout,
    });

    const data = response.data;

    return {
      city: data.name,
      country: data.sys?.country,
      temperature: data.main?.temp,
      feelsLike: data.main?.feels_like,
      humidity: data.main?.humidity,
      pressure: data.main?.pressure,
      windSpeed: data.wind?.speed,
      description: data.weather?.[0]?.description,
      units,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    if (err.response) {
      const status = err.response.status;
      const message = err.response.data?.message || 'Unknown API error';
      throw new Error(`Weather API request failed (${status}): ${message}`);
    } else if (err.request) {
      throw new Error('Weather API request timed out or received no response.');
    } else {
      throw new Error(`Weather request error: ${err.message}`);
    }
  }
}

module.exports = { getWeather };