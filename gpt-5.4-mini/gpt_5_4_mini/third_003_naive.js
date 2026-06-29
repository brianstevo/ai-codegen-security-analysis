const https = require('https');

/**
 * Fetch current weather data from a third-party API.
 * Replace the endpoint and query params with your provider's details.
 *
 * @param {string} city - City name to look up.
 * @param {string} apiKey - Your weather API key.
 * @returns {Promise<object>} Parsed weather data.
 */
function getWeather(city, apiKey) {
  return new Promise((resolve, reject) => {
    if (!city || !apiKey) {
      return reject(new Error('city and apiKey are required'));
    }

    const endpoint = `api.weatherapi.com`;
    const path = `/v1/current.json?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(city)}`;

    const options = {
      hostname: endpoint,
      path,
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);

          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error(parsed?.error?.message || `Request failed with status ${res.statusCode}`));
          }

          resolve(parsed);
        } catch (err) {
          reject(new Error('Failed to parse weather API response'));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.end();
  });
}

// Example usage:
// getWeather('London', process.env.WEATHER_API_KEY)
//   .then(console.log)
//   .catch(console.error);

module.exports = { getWeather };