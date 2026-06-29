import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// Define the weather API tool
const tools = [
  {
    name: "get_weather",
    description:
      "Get the current weather for a location using the Open-Meteo API (free, no key required). Provides temperature, weather conditions, wind speed, and other meteorological data.",
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
          description:
            "Name of the location (for reference, not used in API call)",
        },
      },
      required: ["latitude", "longitude"],
    },
  },
  {
    name: "geocode_location",
    description:
      "Convert a location name to latitude and longitude coordinates using the Nominatim API",
    input_schema: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "Name of the location (e.g., 'New York', 'London')",
        },
      },
      required: ["location"],
    },
  },
];

// Function to call the Open-Meteo weather API
async function getWeather(latitude, longitude) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&temperature_unit=celsius`;

  const response = await fetch(url);
  const data = await response.json();

  return {
    location: `${latitude}, ${longitude}`,
    temperature: data.current.temperature_2m,
    weather_code: data.current.weather_code,
    wind_speed: data.current.wind_speed_10m,
    humidity: data.current.relative_humidity_2m,
    units: data.current.temperature_2m,
  };
}

// Function to geocode a location name to coordinates
async function geocodeLocation(location) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.length === 0) {
    throw new Error(`Location "${location}" not found`);
  }

  return {
    name: data[0].display_name,
    latitude: parseFloat(data[0].lat),
    longitude: parseFloat(data[0].lon),
  };
}

// Function to process tool calls
async function processToolCall(toolName, toolInput) {
  if (toolName === "get_weather") {
    return await getWeather(toolInput.latitude, toolInput.longitude);
  } else if (toolName === "geocode_location") {
    return await geocodeLocation(toolInput.location);
  }
  throw new Error(`Unknown tool: ${toolName}`);
}

// Main function to get weather using Claude with tool use
async function getWeatherForLocation(locationName) {
  console.log(`Getting weather for ${locationName}...`);

  const messages = [
    {
      role: "user",
      content: `What is the current weather in ${locationName}? Please provide temperature, humidity, and wind speed.`,
    },
  ];

  let response = await client.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: 1024,
    tools: tools,
    messages: messages,
  });

  // Process tool calls in an agentic loop
  while (response.stop_reason === "tool_use") {
    const toolUseBlock = response.content.find(
      (block) => block.type === "tool_use"
    );

    if (!toolUseBlock) {
      break;
    }

    console.log(`\nTool Used: ${toolUseBlock.name}`);
    console.log(`Tool Input: ${JSON.stringify(toolUseBlock.input, null, 2)}`);

    const toolResult = await processToolCall(
      toolUseBlock.name,
      toolUseBlock.input
    );

    console.log(`Tool Result: ${JSON.stringify(toolResult, null, 2)}`);

    // Continue the conversation with the tool result
    messages.push({
      role: "assistant",
      content: response.content,
    });

    messages.push({
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: toolUseBlock.id,
          content: JSON.stringify(toolResult),
        },
      ],
    });

    response = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      tools: tools,
      messages: messages,
    });
  }

  // Extract the final text response
  const textBlock = response.content.find((block) => block.type === "text");
  if (textBlock) {
    console.log("\nWeather Information:");
    console.log(textBlock.text);
  }

  return response;
}

// Run the main function
getWeatherForLocation("Paris").catch(console.error);