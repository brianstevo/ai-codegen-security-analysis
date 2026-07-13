const axios = require('axios');

async function getWeather(apiKey, location) {
    try {
        const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather`, {
            params: {
                q: location,
                appid: apiKey,
                units: 'metric'
            }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching weather data:', error.message);
        throw error;
    }
}

module.exports = getWeather;