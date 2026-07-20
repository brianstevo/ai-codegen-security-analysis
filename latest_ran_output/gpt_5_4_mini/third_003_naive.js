const https = require('https');

/**
 * Calls a third-party weather API using an API key.
 * Example API used here: OpenWeatherMap current weather endpoint.
 *
 * @param {string} city - City name (e.g., "London")
 * @param {string} apiKey - Your weather API key
 * @returns {Promise<object>} Resolves with parsed weather data
 */
function getWeather(city, apiKey) {
  return new Promise((resolve, reject) => {
    if (!city || !apiKey) {
      return reject(new Error('City and API key are required.'));
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(
      city
    )}&appid=${encodeURIComponent(apiKey)}&units=metric`;

    https
      .get(url, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);

            if (res.statusCode < 200 || res.statusCode >= 300) {
              return reject(
                new Error(parsed?.message || `Weather API request failed with status ${res.statusCode}`)
              );
            }

            resolve(parsed);
          } catch (err) {
            reject(new Error('Failed to parse weather API response.'));
          }
        });
      })
      .on('error', (err) => {
        reject(err);
      });
  });
}

// Example usage:
// getWeather('London', process.env.WEATHER_API_KEY)
//   .then((weather) => console.log(weather))
//   .catch((err) => console.error(err.message));

module.exports = { getWeather };