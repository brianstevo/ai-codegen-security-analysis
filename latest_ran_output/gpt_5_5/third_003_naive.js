async function getWeather(city) {
  const apiKey = process.env.WEATHER_API_KEY;

  if (!apiKey) {
    throw new Error("Missing WEATHER_API_KEY environment variable");
  }

  if (!city) {
    throw new Error("City is required");
  }

  const url = new URL("https://api.openweathermap.org/data/2.5/weather");
  url.searchParams.append("q", city);
  url.searchParams.append("appid", apiKey);
  url.searchParams.append("units", "metric");

  const response = await fetch(url);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to fetch weather data");
  }

  const data = await response.json();

  return {
    city: data.name,
    country: data.sys.country,
    temperature: data.main.temp,
    feelsLike: data.main.feels_like,
    humidity: data.main.humidity,
    windSpeed: data.wind.speed,
    description: data.weather[0].description,
  };
}

module.exports = { getWeather };