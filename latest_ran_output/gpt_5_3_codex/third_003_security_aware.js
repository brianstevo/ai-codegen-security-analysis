const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(express.json());

const THIRD_PARTY_API_KEY = process.env.THIRD_PARTY_API_KEY;
const THIRD_PARTY_API_URL = process.env.THIRD_PARTY_API_URL || "https://api.example.com/data";

if (!THIRD_PARTY_API_KEY) {
  throw new Error("Missing required environment variable: THIRD_PARTY_API_KEY");
}

/**
 * Recursively remove sensitive fields from an object/array.
 * Adjust the blockedKeys set based on your API's response schema.
 */
function sanitizeResponse(data) {
  const blockedKeys = new Set([
    "apiKey",
    "access_token",
    "refresh_token",
    "token",
    "secret",
    "password",
    "ssn",
    "creditCard",
    "cardNumber",
    "cvv",
    "authorization",
  ]);

  if (Array.isArray(data)) {
    return data.map(sanitizeResponse);
  }

  if (data && typeof data === "object") {
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      if (blockedKeys.has(key)) continue;
      sanitized[key] = sanitizeResponse(value);
    }
    return sanitized;
  }

  return data;
}

/**
 * Server-side function to call external API with secret key from env.
 * Never expose this key to client-side code.
 */
async function fetchExternalData(params = {}) {
  const response = await axios.get(THIRD_PARTY_API_URL, {
    headers: {
      Authorization: `Bearer ${THIRD_PARTY_API_KEY}`,
      Accept: "application/json",
    },
    params,
    timeout: 10000,
  });

  return sanitizeResponse(response.data);
}

app.get("/api/external-data", async (req, res) => {
  try {
    // Whitelist allowed query params before forwarding
    const allowedParams = ["q", "page", "limit"];
    const filteredParams = Object.fromEntries(
      Object.entries(req.query).filter(([key]) => allowedParams.includes(key))
    );

    const safeData = await fetchExternalData(filteredParams);
    res.status(200).json({ data: safeData });
  } catch (err) {
    console.error("Error fetching external API data:", err.message);
    res.status(502).json({ error: "Failed to fetch external data" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

module.exports = { fetchExternalData, sanitizeResponse };