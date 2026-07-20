require("dotenv").config();

const express = require("express");

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;
const EXTERNAL_API_KEY = process.env.EXTERNAL_API_KEY;
const EXTERNAL_API_URL = process.env.EXTERNAL_API_URL || "https://api.example.com/v1/resource";

if (!EXTERNAL_API_KEY) {
  throw new Error("Missing required environment variable: EXTERNAL_API_KEY");
}

const SENSITIVE_FIELD_NAMES = new Set([
  "apiKey",
  "api_key",
  "accessToken",
  "access_token",
  "refreshToken",
  "refresh_token",
  "token",
  "secret",
  "clientSecret",
  "client_secret",
  "password",
  "authorization",
  "auth",
  "privateKey",
  "private_key",
  "session",
  "cookie",
  "ssn",
  "creditCard",
  "credit_card",
]);

function filterSensitiveFields(value) {
  if (Array.isArray(value)) {
    return value.map(filterSensitiveFields);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !SENSITIVE_FIELD_NAMES.has(key))
        .map(([key, nestedValue]) => [key, filterSensitiveFields(nestedValue)])
    );
  }

  return value;
}

function buildSafeClientResponse(rawThirdPartyData) {
  const filtered = filterSensitiveFields(rawThirdPartyData);

  return {
    success: true,
    data: {
      id: filtered.id ?? null,
      name: filtered.name ?? null,
      status: filtered.status ?? null,
      createdAt: filtered.createdAt ?? filtered.created_at ?? null,
      updatedAt: filtered.updatedAt ?? filtered.updated_at ?? null,
      results: Array.isArray(filtered.results)
        ? filtered.results.map((item) => ({
            id: item.id ?? null,
            title: item.title ?? item.name ?? null,
            description: item.description ?? item.summary ?? null,
            status: item.status ?? null,
          }))
        : undefined,
    },
  };
}

async function callExternalApi({ query }) {
  const response = await fetch(EXTERNAL_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${EXTERNAL_API_KEY}`,
    },
    body: JSON.stringify({ query }),
  });

  let rawData;

  try {
    rawData = await response.json();
  } catch {
    rawData = null;
  }

  if (!response.ok) {
    const safeError = filterSensitiveFields(rawData || {});

    const error = new Error("External API request failed");
    error.statusCode = response.status;
    error.safeDetails = {
      message: safeError.message || "Third-party service returned an error",
      code: safeError.code || response.status,
    };

    throw error;
  }

  return buildSafeClientResponse(rawData);
}

app.post("/api/external-resource", async (req, res) => {
  try {
    const { query } = req.body;

    if (typeof query !== "string" || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "query is required",
      });
    }

    const safeResponse = await callExternalApi({
      query: query.trim(),
    });

    return res.json(safeResponse);
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      error: "Unable to complete request",
      details: error.safeDetails || undefined,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});