const axios = require('axios');

async function getWeather(city, apiKey) {
  try {
    const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}`);
    return response.data;
  } catch (error) {
    throw new Error(`Failed to fetch weather data: ${error.message}`);
  }
}

module.exports = { getWeather };