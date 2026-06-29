```javascript
const express = require('express');
const https = require('https');
const http = require('http');

const app = express();
app.use(express.json());

// Configuration
const WEATHER_API_KEY = process.env.WEATHER_API_KEY || 'your_api_key_here';
const WEATHER_API_BASE_URL = 'api.openweathermap.org';
const WEATHER_API_PATH = '/data/2.5/weather';
const FORECAST_API_PATH = '/data/2.5/forecast';

/**
 * Makes a generic HTTP GET request
 * @param {string} hostname - API hostname
 * @param {string} path - API path with query params
 * @returns {Promise<object>} - Parsed JSON response
 */
function makeHttpRequest(hostname, path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      path,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
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

          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ statusCode: res.statusCode, data: parsed });
          } else {
            reject({
              statusCode: res.statusCode,
              message: parsed.message || 'API request failed',
              data: parsed,
            });
          }
        } catch (err) {
          reject({ statusCode: 500, message: 'Failed to parse response', error: err.message });
        }
      });
    });

    req.on('error', (err) => {
      reject({ statusCode: 500, message: 'Network error', error: err.message });
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject({ statusCode: 408, message: 'Request timed out' });
    });

    req.end();
  });
}

/**
 * Fetches current weather data by city name
 * @param {string} city - City name
 * @param {string} units - Units: 'metric', 'imperial', or 'standard'
 * @param {string} lang - Language code (e.g., 'en', 'es')
 * @returns {Promise<object>} - Weather data
 */
async function getWeatherByCity(city, units = 'metric', lang = 'en') {
  if (!city || typeof city !== 'string' || city.trim() === '') {
    throw { statusCode: 400, message: 'City name is required and must be a non-empty string' };
  }

  if (!['metric', 'imperial', 'standard'].includes(units)) {
    throw { statusCode: 400, message: "Units must be 'metric', 'imperial', or 'standard'" };
  }

  const encodedCity = encodeURIComponent(city.trim());
  const path = `${WEATHER_API_PATH}?q=${encodedCity}&appid=${WEATHER_API_KEY}&units=${units}&lang=${lang}`;

  const response = await makeHttpRequest(WEATHER_API_BASE_URL, path);
  return formatWeatherData(response.data, units);
}

/**
 * Fetches current weather data by geographic coordinates
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {string} units - Units: 'metric', 'imperial', or 'standard'
 * @returns {Promise<object>} - Weather data
 */
async function getWeatherByCoordinates(lat, lon, units = 'metric') {
  if (lat === undefined || lon === undefined) {
    throw { statusCode: 400, message: 'Latitude and longitude are required' };
  }

  const parsedLat = parseFloat(lat);
  const parsedLon = parseFloat(lon);

  if (isNaN(parsedLat) || isNaN(parsedLon)) {
    throw { statusCode: 400, message: 'Latitude and longitude must be valid numbers' };
  }

  if (parsedLat < -90 || parsedLat > 90) {
    throw { statusCode: 400, message: 'Latitude must be between -90 and 90' };
  }

  if (parsedLon < -180 || parsedLon > 180) {
    throw { statusCode: 400, message: 'Longitude must be between -180 and 180' };
  }

  const path = `${WEATHER_API_PATH}?lat=${parsedLat}&lon=${parsedLon}&appid=${WEATHER_API_KEY}&units=${units}`;

  const response = await makeHttpRequest(WEATHER_API_BASE_URL, path);
  return formatWeatherData(response.data, units);
}

/**
 * Fetches 5-day weather forecast by city name
 * @param {string} city - City name
 * @param {string} units - Units: 'metric', 'imperial', or 'standard'
 * @returns {Promise<object>} - Forecast data
 */
async function getWeatherForecast(city, units = 'metric') {
  if (!city || typeof city !== 'string' || city.trim() === '') {
    throw { statusCode: 400, message: 'City name is required' };
  }

  const encodedCity = encodeURIComponent(city.trim());
  const path = `${FORECAST_API_PATH}?q=${encodedCity}&appid=${WEATHER_API_KEY}&units=${units}`;

  const response = await makeHttpRequest(WEATHER_API_BASE_URL, path);
  return formatForecastData(response.data, units);
}

/**
 * Formats raw weather API response into a cleaner structure
 * @param {object} data - Raw API response
 * @param {string} units - Units used in the request
 * @returns {object} - Formatted weather data
 */
function formatWeatherData(data, units) {
  const unitSymbols = {
    metric: '°C',
    imperial: '°F',
    standard: 'K',
  };

  return {
    location: {
      city: data.name,
      country: data.sys?.country,
      coordinates: {
        lat: data.coord?.lat,
        lon: data.coord?.lon,
      },
    },
    weather: {
      condition: data.weather?.[0]?.main,
      description: data.weather?.[0]?.description,
      icon: data.weather?.[0]?.icon
        ? `https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`
        : null,
    },
    temperature: {
      current: data.main?.temp,
      feelsLike: data.main?.feels_like,
      min: data.main?.temp_min,
      max: data.main?.temp_max,
      unit: unitSymbols[units] || '°C',
    },
    atmosphere: {
      humidity: data.main?.humidity,
      pressure: data.main?.pressure,
      visibility: data.visibility,
    },
    wind: {
      speed: data.wind?.speed,
      direction: data.wind?.deg,
      gust: data.wind?.gust,
    },
    sun: {
      sunrise: data.sys?.sunrise ? new Date(data.sys.sunrise * 1000).toISOString() : null,
      sunset: data.sys?.sunset ? new Date(data.sys.sunset * 1000).toISOString() : null,
    },
    timestamp: data.dt ? new Date(data.dt * 1000).toISOString() : new Date().toISOString(),
  };
}

/**
 * Formats raw forecast API response into a cleaner structure
 * @param {object} data - Raw forecast API response
 * @param {string} units -