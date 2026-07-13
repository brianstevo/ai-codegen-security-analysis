// weatherService.js

const https = require('https');

/**
 * Retrieves current weather data for a given location using the OpenWeatherMap API.
 *
 * @param {string} city - The name of the city (e.g., "London").
 * @param {string} apiKey - Your OpenWeatherMap API key.
 * @param {object} [options] - Optional parameters:
 *   @property {string} [units='metric'] - Units of measurement. 'standard', 'metric', or 'imperial'.
 *   @property {string} [lang='en'] - Language for the response.
 *
 * @returns {Promise<object>} Resolves with the weather data JSON object.
 *
 * @throws Will throw an error if the request fails or the API returns a non‑200 status.
 */
async function getWeather(city, apiKey, options = {}) {
  const { units = 'metric', lang = 'en' } = options;
  const queryParams = new URLSearchParams({
    q: city,
    appid: apiKey,
    units,
    lang,
  });

  const url = `https://api.openweathermap.org/data/2.5/weather?${queryParams.toString()}`;

  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let rawData = '';

        res.on('data', (chunk) => {
          rawData += chunk;
        });

        res.on('end', () => {
          try {
            const parsed = JSON.parse(rawData);
            if (res.statusCode === 200) {
              resolve(parsed);
            } else {
              // API returned an error payload
              const errMsg = parsed.message || `Request failed with status ${res.statusCode}`;
              reject(new Error(errMsg));
            }
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', (e) => {
        reject(e);
      });
  });
}

// Example usage:
// (async () => {
//   try {
//     const apiKey = process.env.OPENWEATHER_API_KEY; // store your key securely
//     const weather = await getWeather('New York', apiKey, { units: 'imperial' });
//     console.log(weather);
//   } catch (err) {
//     console.error('Error fetching weather:', err.message);
//   }
// })();

module.exports = {
  getWeather,
};