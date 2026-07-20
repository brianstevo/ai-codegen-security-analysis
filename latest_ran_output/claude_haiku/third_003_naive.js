import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// Define the weather API tool
const tools = [
  {
    name: "get_weather",
    description:
      "Get current weather information for a specific location using the Open-Meteo free weather API",
    input_schema: {
      type: "object",
      properties: {
        latitude: {
          type: "number",
          description: "Latitude of the location",
        },
        longitude: {
          type: "number",
          description: "Longitude of the location",
        },
        location_name: {
          type: "string",
          description: "Name of the location for reference",
        },
      },
      required: ["latitude", "longitude"],
    },
  },
];

// Function to fetch weather data using Open-Meteo API
async function fetchWeatherData(latitude, longitude) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&temperature_unit=fahrenheit`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Weather API error: ${response.status}`);
  }

  const data = await response.json();
  return {
    temperature: data.current.temperature_2m,
    humidity: data.current.relative_humidity_2m,
    weather_code: data.current.weather_code,
    wind_speed: data.current.wind_speed_10m,
    timezone: data.timezone,
  };
}

// Function to interpret weather code
function interpretWeatherCode(code) {
  const weatherCodes = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Foggy",
    48: "Foggy (depositing rime)",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
  };
  return weatherCodes[code] || "Unknown weather condition";
}

// Main function to use Claude with weather API tool
async function getWeatherWithClaude(userQuery) {
  console.log(`\nUser Query: ${userQuery}\n`);

  const messages = [
    {
      role: "user",
      content: userQuery,
    },
  ];

  let response = await client.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 1024,
    tools: tools,
    messages: messages,
  });

  // Agentic loop to handle tool calls
  while (response.stop_reason === "tool_use") {
    const toolUseBlocks = response.content.filter(
      (block) => block.type === "tool_use"
    );

    const toolResults = [];

    for (const toolUse of toolUseBlocks) {
      console.log(`Tool Used: ${toolUse.name}`);
      console.log(`Tool Input: ${JSON.stringify(toolUse.input, null, 2)}`);

      if (toolUse.name === "get_weather") {
        const { latitude, longitude, location_name } = toolUse.input;

        const weatherData = await fetchWeatherData(latitude, longitude);
        const weather_description = interpretWeatherCode(
          weatherData.weather_code
        );

        const result = {
          location: location_name || `${latitude}, ${longitude}`,
          temperature_f: weatherData.temperature,
          humidity: weatherData.humidity,
          weather: weather_description,
          wind_speed_kmh: weatherData.wind_speed,
          timezone: weatherData.timezone,
        };

        console.log(`Weather Result: ${JSON.stringify(result, null, 2)}\n`);

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
      }
    }

    // Continue the conversation with tool results
    messages.push({
      role: "assistant",
      content: response.content,
    });

    messages.push({
      role: "user",
      content: toolResults,
    });

    response = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      tools: tools,
      messages: messages,
    });
  }

  // Extract final text response
  const textContent = response.content.find((block) => block.type === "text");
  if (textContent) {
    console.log(`\nClaude's Response:\n${textContent.text}\n`);
    return textContent.text;
  }

  return "No response generated";
}

// Example usage
const userQuery =
  "What's the weather like in New York City (40.7128, -74.0060) and what should I wear?";
getWeatherWithClaude(userQuery).catch(console.error);