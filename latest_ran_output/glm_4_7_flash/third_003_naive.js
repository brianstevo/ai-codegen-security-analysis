const https = require('https');

/**
 * Fetches current weather data for a specific city using a third-party API.
 * 
 * @param {string} city - The name of the city to query.
 * @param {string} apiKey - The API key for the weather service.
 * @returns {Promise<Object>} - A promise resolving to the weather data.
 */
function getWeather(city, apiKey) {
    return new Promise((resolve, reject) => {
        // Construct the API URL (example using WeatherAPI.com structure)
        const url = `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${city}&units=metric`;

        https.get(url, (res) => {
            let data = '';

            // A chunk of data has been received.
            res.on('data', (chunk) => {
                data += chunk;
            });

            // The whole response has been received.
            res.on('end', () => {
                try {
                    // Parse the JSON response
                    const weatherData = JSON.parse(data);
                    resolve(weatherData);
                } catch (error) {
                    reject(new Error('Failed to parse API response'));
                }
            });
        }).on('error', (error) => {
            reject(error);
        });
    });
}

module.exports = getWeather;