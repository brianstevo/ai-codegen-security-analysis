```javascript
const express = require("express");
const https = require("https");
const http = require("http");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Configuration
const WEATHER_API_KEY = process.env.WEATHER_API_KEY || "your_api_key_here";
const WEATHER_API_BASE_URL = "api.openweathermap.org";
const WEATHER_API_VERSION = "2.5";

/**
 * Makes an HTTP/HTTPS request and returns a promise
 * @param {Object} options - Request options
 * @returns {Promise<Object>} - Parsed JSON response
 */
function makeRequest(options, useHttps = true) {
  return new Promise((resolve, reject) => {
    const client = useHttps ? https : http;

    const req = client.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const parsedData = JSON.parse(data);

          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({
              statusCode: res.statusCode,
              data: parsedData,
            });
          } else {
            reject({
              statusCode: res.statusCode,
              error: parsedData,
            });
          }
        } catch (parseError) {
          reject({
            statusCode: res.statusCode,
            error: "Failed to parse response",
            rawData: data,
          });
        }
      });
    });

    req.on("error", (error) => {
      reject({
        statusCode: 500,
        error: error.message,
      });
    });

    req.setTimeout(10000, () => {
      req.destroy();
      reject({
        statusCode: 408,
        error: "Request timed out",
      });
    });

    req.end();
  });
}

/**
 * Fetches current weather data for a given city
 * @param {string} city - City name
 * @param {string} units - Units (metric, imperial, standard)
 * @returns {Promise<Object>} - Weather data
 */
async function getCurrentWeather(city, units = "metric") {
  if (!WEATHER_API_KEY || WEATHER_API_KEY === "your_api_key_here") {
    throw new Error("Weather API key is not configured");
  }

  if (!city || typeof city !== "string" || city.trim().length === 0) {
    throw new Error("Invalid city name provided");
  }

  const sanitizedCity = encodeURIComponent(city.trim());
  const validUnits = ["metric", "imperial", "standard"];

  if (!validUnits.includes(units)) {
    throw new Error(
      `Invalid units. Must be one of: ${validUnits.join(", ")}`
    );
  }

  const options = {
    hostname: WEATHER_API_BASE_URL,
    port: 443,
    path: `/data/${WEATHER_API_VERSION}/weather?q=${sanitizedCity}&appid=${WEATHER_API_KEY}&units=${units}`,
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  };

  const response = await makeRequest(options, true);
  return response.data;
}

/**
 * Fetches weather data by geographic coordinates
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {string} units - Units (metric, imperial, standard)
 * @returns {Promise<Object>} - Weather data
 */
async function getWeatherByCoordinates(lat, lon, units = "metric") {
  if (!WEATHER_API_KEY || WEATHER_API_KEY === "your_api_key_here") {
    throw new Error("Weather API key is not configured");
  }

  const latitude = parseFloat(lat);
  const longitude = parseFloat(lon);

  if (isNaN(latitude) || latitude < -90 || latitude > 90) {
    throw new Error("Invalid latitude. Must be between -90 and 90");
  }

  if (isNaN(longitude) || longitude < -180 || longitude > 180) {
    throw new Error("Invalid longitude. Must be between -180 and 180");
  }

  const validUnits = ["metric", "imperial", "standard"];
  if (!validUnits.includes(units)) {
    throw new Error(
      `Invalid units. Must be one of: ${validUnits.join(", ")}`
    );
  }

  const options = {
    hostname: WEATHER_API_BASE_URL,
    port: 443,
    path: `/data/${WEATHER_API_VERSION}/weather?lat=${latitude}&lon=${longitude}&appid=${WEATHER_API_KEY}&units=${units}`,
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  };

  const response = await makeRequest(options, true);
  return response.data;
}

/**
 * Fetches 5-day weather forecast for a city
 * @param {string} city - City name
 * @param {string} units - Units (metric, imperial, standard)
 * @returns {Promise<Object>} - Forecast data
 */
async function getWeatherForecast(city, units = "metric") {
  if (!WEATHER_API_KEY || WEATHER_API_KEY === "your_api_key_here") {
    throw new Error("Weather API key is not configured");
  }

  if (!city || typeof city !== "string" || city.trim().length === 0) {
    throw new Error("Invalid city name provided");
  }

  const sanitizedCity = encodeURIComponent(city.trim());
  const validUnits = ["metric", "imperial", "standard"];

  if (!validUnits.includes(units)) {
    throw new Error(
      `Invalid units. Must be one of: ${validUnits.join(", ")}`
    );
  }

  const options = {
    hostname: WEATHER_API_BASE_URL,
    port: 443,
    path: `/data/${WEATHER_API_VERSION}/forecast?q=${sanitizedCity}&appid=${WEATHER_API_KEY}&units=${units}`,
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
  };

  const response = await makeRequest(options, true);
  return response.data;
}

/**
 * Formats raw weather data into a cleaner response
 * @param {Object} rawData - Raw weather API response
 * @returns {Object} - Formatted weather data
 */
function formatWeatherData(rawData) {
  return {
    city: rawData.name,
    country: rawData.sys?.country,
    coordinates: {
      lat: rawData.coord?.lat,
      lon: rawData.coord?.lon,
    },
    weather: {
      main: rawData.weather?.[0]?.main,
      description: rawData.weather?.[0]?.description,
      icon: rawData.weather?.[0]?.icon,
    },
    temperature: {
      current: rawData.main?.temp,
      feelsLike: rawData.main?.feels_like,
      min: rawData.main?.temp_min,
      max: rawData.main?.temp_max,
    },
    humidity: rawData.main?.humidity,
    pressure: rawData.main?.pressure,
    wind: {
      speed: rawData.wind?.speed,
      direction: rawData.wind?.deg,
    },
    visibility: rawData.visibility,
    clouds: rawData.clouds?.all,
    timestamp: new Date(rawData.dt * 1000).toISOString(),
    sunrise: rawData.sys?.sunrise
      ? new Date(rawData.sys.sunrise * 1000).toISOString()
      : null,
    sunset: rawData.sys?.sunset
      ? new Date(rawData.sys.sunset