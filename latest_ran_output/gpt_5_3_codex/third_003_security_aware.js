const express = require("express");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const THIRD_PARTY_API_KEY = process.env.THIRD_PARTY_API_KEY;
const THIRD_PARTY_BASE_URL = process.env.THIRD_PARTY_BASE_URL || "https://api.example.com";

if (!THIRD_PARTY_API_KEY) {
  throw new Error("Missing required env var: THIRD_PARTY_API_KEY");
}

/**
 * Remove sensitive fields recursively from objects/arrays.
 */
function redactSensitiveFields(data, sensitiveKeys = ["apiKey", "token", "secret", "password", "ssn", "creditCard"]) {
  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveFields(item, sensitiveKeys));
  }

  if (data && typeof data === "object") {
    const cleaned = {};
    for (const [key, value] of Object.entries(data)) {
      if (sensitiveKeys.includes(key)) continue;
      cleaned[key] = redactSensitiveFields(value, sensitiveKeys);
    }
    return cleaned;
  }

  return data;
}

/**
 * Server-side only function to call an external API with secret key from env.
 */
async function fetchExternalData(endpoint, params = {}) {
  const url = `${THIRD_PARTY_BASE_URL.replace(/\/+$/, "")}/${endpoint.replace(/^\/+/, "")}`;

  const response = await axios.get(url, {
    params,
    headers: {
      Authorization: `Bearer ${THIRD_PARTY_API_KEY}`,
      "Content-Type": "application/json",
    },
    timeout: 10000,
  });

  return response.data;
}

app.get("/api/external-data", async (req, res) => {
  try {
    // Example params from client (safe to pass if validated/sanitized as needed)
    const { q = "default" } = req.query;

    // Call external API server-side
    const rawData = await fetchExternalData("/v1/search", { q });

    // Filter out sensitive fields before returning to client
    const safeData = redactSensitiveFields(rawData, [
      "apiKey",
      "token",
      "secret",
      "refresh_token",
      "access_token",
      "password",
      "ssn",
      "creditCard",
      "billingDetails",
    ]);

    return res.status(200).json({
      success: true,
      data: safeData,
    });
  } catch (error) {
    const status = error.response?.status || 500;
    return res.status(status).json({
      success: false,
      error: "Failed to fetch external data",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});