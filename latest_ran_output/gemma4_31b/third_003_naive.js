const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

/**
 * GET /api/weather?city=London
 * Fetches current weather data for a specific city using the OpenWeatherMap API.
 */
app.get('/api/weather', async (req, res) => {
    const { city } = req.query;
    const apiKey = process.env.WEATHER_API_KEY;

    if (!city) {
        return res.status(400).json({ error: 'City parameter is required' });
    }

    if (!apiKey) {
        return res.status(500).json({ error: 'Weather API key is not configured on the server' });
    }

    try {
        // Calling OpenWeatherMap API
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;
        const response = await axios.get(url);

        const data = response.data;
        
        // Formatting the response to return only necessary information
        const weatherInfo = {
            city: data.name,
            temperature: `${data.main.temp}°C`,
            condition: data.weather[0].description,
            humidity: `${data.main.humidity}%`,
            windSpeed: `${data.wind.speed} m/s`
        };

        return res.json(weatherInfo);
    } catch (error) {
        if (error.response) {
            // The request was made and the server responded with a status code outside of 2xx
            const status = error.response.status;
            const message = status === 404 ? 'City not found' : 'Error fetching weather data';
            return res.status(status).json({ error: message });
        } else if (error.request) {
            // The request was made but no response was received
            return res.status(503).json({ error: 'Weather service is currently unreachable' });
        } else {
            // Something happened in setting up the request
            return res.status(500).json({ error: 'Internal Server Error' });
        }
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Example usage: http://localhost:${PORT}/api/weather?city=London`);
});

module.exports = app;