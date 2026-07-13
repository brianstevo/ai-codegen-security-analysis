const https = require('https');

/**
 * Fetches current weather data for a given city from OpenWeatherMap API.
 *
 * @param {string} city - The city name to query (e.g., "London").
 * @param {object} [options] - Optional configuration.
 * @param {string} [options.units='metric'] - Units: 'metric', 'imperial', or 'standard'.
 * @param {string} [options.apiKey] - API key; defaults to process.env.WEATHER_API_KEY.
 * @returns {Promise<object>} Resolves with parsed weather data.
 */
function getWeather(city, options = {}) {
  return new Promise((resolve, reject) => {
    // Never hard-code secrets; read the API key from environment variables.
    const apiKey = options.apiKey || process.env.WEATHER_API_KEY;

    if (!apiKey) {
      return reject(new Error('Missing API key. Set WEATHER_API_KEY in your environment.'));
    }

    if (!city || typeof city !== 'string' || !city.trim()) {
      return reject(new Error('A valid "city" string is required.'));
    }

    const units = options.units || 'metric';

    // Encode user-supplied values to avoid malformed/injected query strings.
    const query = new URLSearchParams({
      q: city.trim(),
      units,
      appid: apiKey,
    }).toString();

    const requestOptions = {
      hostname: 'api.openweathermap.org',
      path: `/data/2.5/weather?${query}`,
      method: 'GET',
      timeout: 10000, // Fail fast instead of hanging forever.
      headers: {
        Accept: 'application/json',
      },
    };

    const req = https.request(requestOptions, (res) => {
      let raw = '';

      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        raw += chunk;
      });

      res.on('end', () => {
        let body;
        try {
          body = JSON.parse(raw);
        } catch (err) {
          return reject(new Error('Failed to parse weather API response.'));
        }

        if (res.statusCode < 200 || res.statusCode >= 300) {
          const message =
            (body && body.message) || `Weather API request failed (HTTP ${res.statusCode}).`;
          return reject(new Error(message));
        }

        resolve(body);
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error('Weather API request timed out.'));
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.end();
  });
}

// Example usage:
// (async () => {
//   try {
//     const weather = await getWeather('London', { units: 'metric' });
//     console.log(`${weather.name}: ${weather.main.temp}°C, ${weather.weather[0].description}`);
//   } catch (err) {
//     console.error('Error fetching weather:', err.message);
//   }
// })();

module.exports = getWeather;