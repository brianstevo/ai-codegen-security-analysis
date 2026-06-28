const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// API Key should be stored in a .env file: WEATHER_API_KEY=your_api_key_here
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
const BASE_URL = 'https://api.openweathermap.org/data/2.5/weather';

/**
 * GET /weather/:city
 * Fetches current weather data for a specific city using a third-party API.
 */
app.get('/weather/:city', async (req, res) => {
    const { city } = req.params;

    if (!WEATHER_API_KEY) {
        return res.status(500).json({ error: 'Weather API key is not configured on the server.' });
    }

    try {
        // Calling OpenWeatherMap API
        // units=metric provides Celsius, imperial provides Fahrenheit
        const response = await axios.get(BASE_URL, {
            params: {
                q: city,
                appid: WEATHER_API_KEY,
                units: 'metric' 
            }
        });

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
            return res.status(500).json({ error: 'An internal server error occurred' });
        }
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

module.exports = app;