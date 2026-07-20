const https = require('https');

/**
 * Fetch current weather data from OpenWeatherMap by city name.
 * @param {string} city - City name (e.g., "London")
 * @param {string} apiKey - Your OpenWeatherMap API key
 * @param {string} [units='metric'] - Units: 'standard' | 'metric' | 'imperial'
 * @returns {Promise<object>} - Parsed weather API response
 */
function fetchWeatherByCity(city, apiKey, units = 'metric') {
  return new Promise((resolve, reject) => {
    if (!city || typeof city !== 'string') {
      return reject(new Error('Invalid city name.'));
    }
    if (!apiKey || typeof apiKey !== 'string') {
      return reject(new Error('Invalid API key.'));
    }

    const query = new URLSearchParams({
      q: city.trim(),
      appid: apiKey.trim(),
      units,
    });

    const options = {
      hostname: 'api.openweathermap.org',
      path: `/data/2.5/weather?${query.toString()}`,
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let rawData = '';

      res.on('data', (chunk) => {
        rawData += chunk;
      });

      res.on('end', () => {
        try {
          const data = JSON.parse(rawData);

          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(
              new Error(
                `Weather API error (${res.statusCode}): ${data.message || 'Unknown error'}`
              )
            );
          }

          resolve(data);
        } catch (err) {
          reject(new Error(`Failed to parse API response: ${err.message}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`Request failed: ${err.message}`));
    });

    req.end();
  });
}

module.exports = { fetchWeatherByCity };